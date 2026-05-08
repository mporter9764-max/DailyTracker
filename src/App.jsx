import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { ACTIVITIES, calcBMR, calcTDEE, calcExerciseCalories, DEFAULT_PROFILE } from './tdee'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  return date.toISOString().split('T')[0]
}

function isToday(dateStr) { return dateStr === todayStr() }

const ONE_YEAR_AGO = (() => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]
})()

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Btn({ children, variant = 'primary', onClick, style = {}, disabled = false }) {
  const base = { padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'inherit', transition: 'all 0.15s', opacity: disabled ? 0.5 : 1 }
  const variants = {
    primary: { background: 'var(--accent)', color: 'white', border: 'none' },
    outline: { background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'var(--red)', color: 'white', border: 'none' },
  }
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)', ...style
    }}>{children}</div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{children}</div>
}

function StatCard({ value, label, color }) {
  return (
    <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--accent)', gap: 12, fontSize: 14 }}>
      <div style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading...
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Log Tab ───────────────────────────────────────────────────────────────────
// ── Log Tab ───────────────────────────────────────────────────────────────────
// ── Log Tab ───────────────────────────────────────────────────────────────────
function LogTab({ profile, onSaveDay }) {
  const [currentDate, setCurrentDate] = useState(todayStr())
  const [dayData, setDayData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const emptyDay = useCallback(() => ({
    food: [
      { item: '', calories: '' },
      { item: '', calories: '' },
      { item: '', calories: '' },
    ],
    exercise: [{ activity: 'Jogging (5mph)', duration: '', calories: '' }],
    activityBlocks: profile.activityBlocks || DEFAULT_PROFILE.activityBlocks,
    weight: '',
    weightUnit: 'lbs',
  }), [profile])

  const loadDay = useCallback(async (date) => {
    setLoading(true)
    const { data } = await supabase.from('daily_log').select('*').eq('date', date).limit(1)
    if (data && data.length > 0) {
      setDayData(data[0].data)
    } else {
      setDayData(emptyDay())
    }
    setLoading(false)
  }, [emptyDay])

  useEffect(() => { loadDay(currentDate) }, [currentDate, loadDay])

  const navigate = (dir) => {
    const next = addDays(currentDate, dir)
    if (next > todayStr()) return
    if (next < ONE_YEAR_AGO) return
    setCurrentDate(next)
  }

  const updateFood = (idx, field, val) => {
    const food = [...dayData.food]
    food[idx] = { ...food[idx], [field]: val }
    setDayData({ ...dayData, food })
  }

  const addFood = () => setDayData({ ...dayData, food: [...dayData.food, { item: '', calories: '' }] })
  const removeFood = (idx) => setDayData({ ...dayData, food: dayData.food.filter((_, i) => i !== idx) })

  const updateExercise = (idx, field, val) => {
    const exercise = [...dayData.exercise]
    exercise[idx] = { ...exercise[idx], [field]: val }
    if (field === 'activity' || field === 'duration') {
      const row = { ...exercise[idx], [field]: val }
      const dur = parseFloat(row.duration) || 0
      if (dur > 0 && row.activity) {
        const w = profile.weightLbs || DEFAULT_PROFILE.weightLbs
        exercise[idx] = { ...row, calories: calcExerciseCalories(row.activity, dur, w) }
      } else {
        exercise[idx] = row
      }
    }
    setDayData({ ...dayData, exercise })
  }

  const addExercise = () => setDayData({ ...dayData, exercise: [...dayData.exercise, { activity: 'Jogging (5mph)', duration: '', calories: '' }] })
  const removeExercise = (idx) => setDayData({ ...dayData, exercise: dayData.exercise.filter((_, i) => i !== idx) })

  const updateActivityBlock = (idx, field, val) => {
    const blocks = [...(dayData.activityBlocks || [])]
    blocks[idx] = { ...blocks[idx], [field]: field === 'hours' ? parseFloat(val) || 0 : val }
    setDayData({ ...dayData, activityBlocks: blocks })
  }
  const addActivityBlock = () => setDayData({ ...dayData, activityBlocks: [...(dayData.activityBlocks || []), { activity: 'Standing', hours: 1 }] })
  const removeActivityBlock = (idx) => setDayData({ ...dayData, activityBlocks: (dayData.activityBlocks || []).filter((_, i) => i !== idx) })
  const resetActivityBlocks = () => setDayData({ ...dayData, activityBlocks: profile.activityBlocks || DEFAULT_PROFILE.activityBlocks })

  const totalEaten = dayData?.food.reduce((s, f) => s + (parseFloat(f.calories) || 0), 0) || 0
  const totalBurned = dayData?.exercise.reduce((s, e) => s + (parseFloat(e.calories) || 0), 0) || 0
  const netCals = totalEaten - totalBurned
  const dayTDEE = calcTDEE(
    profile.weightLbs || DEFAULT_PROFILE.weightLbs,
    profile.bodyFatPct || DEFAULT_PROFILE.bodyFatPct,
    dayData?.activityBlocks || DEFAULT_PROFILE.activityBlocks
  )
  const deficit = dayTDEE - Math.round(netCals)
  const totalActivityHours = (dayData?.activityBlocks || []).reduce((s, b) => s + (parseFloat(b.hours) || 0), 0)

  const handleSave = async () => {
    setSaving(true)
    const bmr = Math.round(calcBMR(profile.weightLbs || DEFAULT_PROFILE.weightLbs, profile.bodyFatPct || DEFAULT_PROFILE.bodyFatPct))

    const record = {
      date: currentDate,
      data: {
        ...dayData,
        snapshot: {
          weightLbs: profile.weightLbs,
          bodyFatPct: profile.bodyFatPct,
          age: profile.age,
          bmr,
          tdee: dayTDEE,
          activityBlocks: dayData.activityBlocks,
        },
        totals: { eaten: Math.round(totalEaten), burned: Math.round(totalBurned), net: Math.round(netCals), tdee: dayTDEE, deficit },
      },
    }

    const { error } = await supabase.from('daily_log').upsert(record, { onConflict: 'date' })
    if (error) alert('Save failed: ' + error.message)
    else onSaveDay()
    setSaving(false)
  }

  if (loading) return <Spinner />

  return (
    <div>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 13, color: 'var(--text-primary)' }}>← Prev</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
          {formatDate(currentDate)}{isToday(currentDate) ? ' — Today' : ''}
        </div>
        <button onClick={() => navigate(1)} disabled={isToday(currentDate)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 13, color: isToday(currentDate) ? 'var(--text-muted)' : 'var(--text-primary)' }}>Next →</button>
      </div>

      {/* Stats — 5 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
        <StatCard value={Math.round(totalEaten).toLocaleString()} label="calories eaten" />
        <StatCard value={Math.round(totalBurned).toLocaleString()} label="calories burned" color="var(--accent)" />
        <StatCard value={Math.round(netCals).toLocaleString()} label="net calories" />
      </div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatCard value={Math.round(totalEaten).toLocaleString()} label="calories eaten" />
        <StatCard value={dayTDEE.toLocaleString()} label="today's TDEE" color="var(--amber)" />
        <StatCard
          value={deficit > 0 ? `−${deficit.toLocaleString()}` : `+${Math.abs(deficit).toLocaleString()}`}
          label={deficit > 0 ? 'deficit vs TDEE' : 'surplus vs TDEE'}
          color={deficit > 0 ? 'var(--accent)' : 'var(--red)'}
        />
      </div>

     {/* Food log */}
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Food log</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Item</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Calories</div>
          <div />
        </div>
        {dayData.food.map((row, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 28px', gap: 6, marginBottom: 6 }}>
            <input value={row.item} onChange={e => updateFood(idx, 'item', e.target.value)} placeholder="What did you eat?" />
            <input type="number" value={row.calories} onChange={e => updateFood(idx, 'calories', e.target.value)} placeholder="cal" />
            <button onClick={() => removeFood(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}
        <button onClick={addFood} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', width: '100%', padding: '7px', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>+ add item</button>
      </Card>

      {/* Daily activity blocks */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <SectionLabel>Today's activity profile</SectionLabel>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: totalActivityHours === 24 ? 'var(--accent)' : 'var(--red)', fontWeight: 700 }}>{totalActivityHours} / 24 hrs</span>
            <button onClick={resetActivityBlocks} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 11, padding: '3px 10px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Reset to defaults</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Activity</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hours</div>
          <div />
        </div>
        {(dayData.activityBlocks || []).map((block, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 6 }}>
            <select value={block.activity} onChange={e => updateActivityBlock(idx, 'activity', e.target.value)} style={{ width: '100%' }}>
              {ACTIVITIES.map(a => <option key={a.label} value={a.label}>{a.label}</option>)}
            </select>
            <input type="number" value={block.hours} onChange={e => updateActivityBlock(idx, 'hours', e.target.value)} step="0.5" style={{ width: '100%' }} />
            <button onClick={() => removeActivityBlock(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}
        <button onClick={addActivityBlock} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', width: '100%', padding: '7px', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>+ add activity block</button>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>TDEE updates live as you adjust. Pre-populated from your profile defaults.</p>
      </Card>

{/* Exercise */}

      {/* Weight */}
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Weight (optional)</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Today's weight</div>
            <input type="number" value={dayData.weight} onChange={e => setDayData({ ...dayData, weight: e.target.value })} placeholder="e.g. 204.5" style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Unit</div>
            <select value={dayData.weightUnit} onChange={e => setDayData({ ...dayData, weightUnit: e.target.value })} style={{ width: '100%' }}>
              <option>lbs</option>
              <option>kg</option>
            </select>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="outline" onClick={() => setDayData(emptyDay())}>Clear</Btn>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save day'}</Btn>
      </div>
    </div>
  )
}
// ── Trends Tab ────────────────────────────────────────────────────────────────
// ── Trends Tab ────────────────────────────────────────────────────────────────
function TrendsTab({ profile }) {
  const [range, setRange] = useState(30)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const loadLogs = useCallback(async (days) => {
    setLoading(true)
    const from = addDays(todayStr(), -days)
    const { data } = await supabase.from('daily_log').select('*').gte('date', from).order('date', { ascending: true })
    setLogs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadLogs(range) }, [range, loadLogs])

  const tdee = calcTDEE(profile.weightLbs || DEFAULT_PROFILE.weightLbs, profile.bodyFatPct || DEFAULT_PROFILE.bodyFatPct, profile.activityBlocks || DEFAULT_PROFILE.activityBlocks)

  const labels = logs.map(l => {
    const [, m, d] = l.date.split('-')
    return `${m}/${d}`
  })

  const calData = logs.map(l => l.data?.totals?.eaten || null)
  const weightData = logs.map(l => l.data?.weight ? parseFloat(l.data.weight) : null)
  const tdeeData = logs.map(l => l.data?.snapshot?.tdee || tdee)
  const sleepData = logs.map(l => {
    const blocks = l.data?.activityBlocks || l.data?.snapshot?.activityBlocks || []
    const sleepBlock = blocks.find(b => b.activity === 'Sleeping')
    return sleepBlock ? parseFloat(sleepBlock.hours) : null
  })

  const daysLogged = logs.filter(l => l.data?.totals?.eaten).length
  const avgCal = daysLogged > 0 ? Math.round(calData.filter(Boolean).reduce((a, b) => a + b, 0) / daysLogged) : 0
  const avgWeight = (() => {
    const w = weightData.filter(Boolean)
    return w.length > 0 ? (w.reduce((a, b) => a + b, 0) / w.length).toFixed(1) : '—'
  })()
  const avgSleep = (() => {
    const s = sleepData.filter(Boolean)
    return s.length > 0 ? (s.reduce((a, b) => a + b, 0) / s.length).toFixed(1) : '—'
  })()
  const avgDeficit = daysLogged > 0 ? Math.round(tdee - avgCal) : 0

  const calChartData = {
    labels,
    datasets: [
      {
        label: 'Calories eaten',
        data: calData,
        borderColor: '#2D6A4F',
        backgroundColor: 'rgba(45,106,79,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: range > 90 ? 0 : 3,
        yAxisID: 'y',
        spanGaps: true,
      },
      {
        label: 'TDEE',
        data: tdeeData,
        borderColor: '#B7610A',
        borderDash: [3, 4],
        backgroundColor: 'transparent',
        tension: 0,
        pointRadius: 0,
        yAxisID: 'y',
        spanGaps: true,
      },
      {
        label: 'Weight (lbs)',
        data: weightData,
        borderColor: '#185FA5',
        borderDash: [5, 3],
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: range > 90 ? 0 : 3,
        yAxisID: 'y2',
        spanGaps: true,
      },
    ],
  }

const sleepChartData = {
    labels,
    datasets: [
      {
        label: 'Sleep (hrs)',
        data: sleepData,
        borderColor: '#6B4FA0',
        backgroundColor: 'rgba(107,79,160,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: range > 90 ? 0 : 3,
        spanGaps: true,
      },
      {
        label: `Avg (${avgSleep} hrs)`,
        data: labels.map(() => avgSleep === '—' ? null : parseFloat(avgSleep)),
        borderColor: '#B7610A',
        borderDash: [4, 3],
        backgroundColor: 'transparent',
        tension: 0,
        pointRadius: 0,
        spanGaps: true,
      },
    ],
  }

  const calChartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { font: { size: 11 }, boxWidth: 20, padding: 12 } } },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: 'rgba(0,0,0,0.04)' } },
      y: { position: 'left', ticks: { font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: 'Calories', font: { size: 10 } } },
      y2: { position: 'right', ticks: { font: { size: 10 } }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Weight (lbs)', font: { size: 10 } } },
    },
  }

  const sleepChartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { font: { size: 11 }, boxWidth: 20, padding: 12 } } },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { color: 'rgba(0,0,0,0.04)' } },
      y: {
        ticks: { font: { size: 10 } },
        grid: { color: 'rgba(0,0,0,0.04)' },
        title: { display: true, text: 'Hours', font: { size: 10 } },
        min: 0, max: 12,
      },
    },
  }

  const RANGES = [7, 30, 90, 365]
  const RANGE_LABELS = { 7: '7 days', 30: '30 days', 90: '90 days', 365: '1 year' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {RANGES.map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: '5px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: range === r ? 'var(--header)' : 'none',
            color: range === r ? 'white' : 'var(--text-secondary)',
            fontSize: 12, fontFamily: 'inherit',
          }}>{RANGE_LABELS[r]}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Calories & Weight</div>
            {logs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No data logged yet. Start tracking to see your trends.</p>
            ) : (
              <Line data={calChartData} options={calChartOptions} />
            )}
          </Card>

          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Sleep</div>
            {logs.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No data logged yet.</p>
            ) : (
              <Line data={sleepChartData} options={sleepChartOptions} />
            )}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <StatCard value={avgCal.toLocaleString()} label="avg daily calories" />
            <StatCard value={tdee.toLocaleString()} label="profile TDEE" color="var(--amber)" />
            <StatCard value={avgWeight} label="avg weight (lbs)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <StatCard value={avgDeficit > 0 ? `−${avgDeficit.toLocaleString()}` : `+${Math.abs(avgDeficit).toLocaleString()}`} label="avg daily vs TDEE" color={avgDeficit > 0 ? 'var(--accent)' : 'var(--red)'} />
            <StatCard value={avgSleep} label="avg sleep (hrs)" color="#6B4FA0" />
            <StatCard value={daysLogged} label="days logged" />
          </div>
        </>
      )}
    </div>
  )
}



            
// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ profile, onSaveProfile }) {
  const [form, setForm] = useState(profile)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setForm(profile) }, [profile])

  const set = k => e => setForm({ ...form, [k]: e.target.value })

  const updateBlock = (idx, field, val) => {
    const blocks = [...form.activityBlocks]
    blocks[idx] = { ...blocks[idx], [field]: field === 'hours' ? parseFloat(val) || 0 : val }
    setForm({ ...form, activityBlocks: blocks })
  }

  const addBlock = () => setForm({ ...form, activityBlocks: [...form.activityBlocks, { activity: 'Standing', hours: 1 }] })
  const removeBlock = idx => setForm({ ...form, activityBlocks: form.activityBlocks.filter((_, i) => i !== idx) })

  const totalHours = form.activityBlocks.reduce((s, b) => s + (parseFloat(b.hours) || 0), 0)
  const bmr = Math.round(calcBMR(parseFloat(form.weightLbs) || 0, parseFloat(form.bodyFatPct) || 0))
  const tdee = calcTDEE(parseFloat(form.weightLbs) || 0, parseFloat(form.bodyFatPct) || 0, form.activityBlocks)

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...form,
      weightLbs: parseFloat(form.weightLbs),
      bodyFatPct: parseFloat(form.bodyFatPct),
      age: parseInt(form.age),
    }
    const { error } = await supabase.from('profile').upsert({ id: 1, data: payload }, { onConflict: 'id' })
    if (error) alert('Save failed: ' + error.message)
    else onSaveProfile(payload)
    setSaving(false)
  }

  return (
    <div>
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Body stats</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Weight (lbs)</div>
            <input type="number" value={form.weightLbs} onChange={set('weightLbs')} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Body fat %</div>
            <input type="number" value={form.bodyFatPct} onChange={set('bodyFatPct')} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Age</div>
            <input type="number" value={form.age} onChange={set('age')} style={{ width: '100%' }} />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Typical daily activity (24 hrs)</SectionLabel>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
          Total: <strong style={{ color: totalHours === 24 ? 'var(--accent)' : 'var(--red)' }}>{totalHours} hrs</strong> — must equal 24
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Activity</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hours</div>
          <div />
        </div>
        {form.activityBlocks.map((block, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 28px', gap: 6, marginBottom: 6 }}>
            <select value={block.activity} onChange={e => updateBlock(idx, 'activity', e.target.value)} style={{ width: '100%' }}>
              {ACTIVITIES.map(a => <option key={a.label} value={a.label}>{a.label}</option>)}
            </select>
            <input type="number" value={block.hours} onChange={e => updateBlock(idx, 'hours', e.target.value)} step="0.5" style={{ width: '100%' }} />
            <button onClick={() => removeBlock(idx)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}
        <button onClick={addBlock} style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', width: '100%', padding: '7px', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>+ add activity block</button>
      </Card>

      <Card style={{ marginBottom: 16, background: 'var(--bg-hover)' }}>
        <SectionLabel>Calculated TDEE</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <StatCard value={bmr.toLocaleString()} label="BMR (cal/day)" />
          <StatCard value={(tdee - bmr).toLocaleString()} label="activity burn" />
          <StatCard value={tdee.toLocaleString()} label="TDEE (cal/day)" color="var(--accent)" />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Uses Katch-McArdle BMR + MET activity profile + 10% thermic effect. Profile changes do not affect historical data.
        </p>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</Btn>
      </div>
    </div>
  )
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('log')
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('profile').select('*').limit(1)
        if (data && data.length > 0) setProfile(data[0].data)
      } catch (e) {
        setError('Could not connect to database.')
      }
      setLoaded(true)
    })()
  }, [])

  const handleSaveProfile = (updated) => setProfile(updated)
  const handleSaveDay = () => {} // trigger any refresh needed

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Spinner />
    </div>
  )

  const TABS = [['log', '📋', 'Log'], ['trends', '📈', 'Trends'], ['profile', '⚙️', 'Profile & TDEE']]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--header)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--accent-light)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 2 }}>My</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#FDF8F2', fontWeight: 400, letterSpacing: '0.02em' }}>Daily Tracker</h1>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(([key, icon, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: tab === key ? 'rgba(255,255,255,0.15)' : 'none',
              border: 'none', color: tab === key ? 'white' : 'rgba(255,255,255,0.5)',
              padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12,
              fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '0.03em',
            }}>
              <span style={{ marginRight: 5 }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--red-bg)', borderBottom: '1px solid var(--red)', padding: '10px 28px' }}>
          <p style={{ fontSize: 13, color: 'var(--red)' }}>⚠ {error}</p>
        </div>
      )}

      <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto' }}>
        {tab === 'log' && <LogTab profile={profile} onSaveDay={handleSaveDay} />}
        {tab === 'trends' && <TrendsTab profile={profile} />}
        {tab === 'profile' && <ProfileTab profile={profile} onSaveProfile={handleSaveProfile} />}
      </div>
    </div>
  )
}
