import { Save } from 'lucide-react'

const EVENT_TYPES = [
  { value: 'CME / RTM', label: 'CME / RTM' },
  { value: 'Advisory Board', label: 'Advisory Board' },
  { value: 'Corporate Sponsorship', label: 'Corporate Sponsorship' },
]
const PLATFORMS = ['In Person Meeting', 'Virtual Meeting', 'Both']
const BUDGET_TYPES = ['Head Office', 'Field', 'Both']
const CONFERENCE_TYPES = ['NCON', 'RCON', 'Local']
const SPONSORSHIP_TYPES_OPTIONS = ['Stall', 'Scientific Session', 'Advertising Space', 'Other']

export default function EventFormStep1({
  register, errors, watch, setValue, handleSubmit, saving, user,
  divisions, therapeutics, brands,
  isCME, isAdvisory, isSponsorship,
  onSave, onCancel,
}) {
  const selectedDivisionId = watch('division_id')
  const selectedDiv = divisions.find(d => String(d.id) === String(selectedDivisionId))

  return (
    <form onSubmit={handleSubmit(d => onSave(d, true))} className="card space-y-5">
      <h3 className="text-lg font-bold">Event Details</h3>

      {/* Row 1: Auto-populated fields */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <label className="label">Initiated By</label>
          <input className="input bg-gray-50" value={`${user?.first_name || ''} ${user?.last_name || ''}`} disabled />
        </div>
        <div>
          <label className="label">Employee ID</label>
          <input className="input bg-gray-50" value={user?.employee_id || '—'} disabled />
        </div>
        <div>
          <label className="label">Division</label>
          <select className="input" {...register('division_id')} onChange={e => {
            const val = e.target.value
            setValue('division_id', val)
            const div = divisions.find(d => String(d.id) === val)
            setValue('cost_center', div?.costcenter || '')
          }}>
            <option value="">Select</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Cost-Center</label>
          <input className="input bg-gray-50" value={selectedDiv?.costcenter || ''} disabled />
          <input type="hidden" {...register('cost_center')} />
        </div>
      </div>

      {/* Row 2: Event type, title, platform */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Select Event *</label>
          <select className="input" {...register('event_type', { required: 'Required' })}>
            <option value="">Select type</option>
            {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {errors.event_type && <p className="text-xs text-red-500 mt-1">{errors.event_type.message}</p>}
        </div>
        <div>
          {isCME ? (
            <>
              <label className="label">Event Category *</label>
              <select className="input" {...register('event_title', { required: 'Required' })}>
                <option value="">Select category</option>
                <option value="CME Event">CME Event</option>
                <option value="Hospital">Hospital</option>
              </select>
            </>
          ) : (
            <>
              <label className="label">Title of the Program *</label>
              <input className="input" {...register('event_title', { required: 'Required' })} />
            </>
          )}
          {errors.event_title && <p className="text-xs text-red-500 mt-1">{errors.event_title.message}</p>}
        </div>
        <div>
          <label className="label">Platform of The Event *</label>
          <select className="input" {...register('platform', { required: 'Required' })}>
            <option value="">Select</option>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Row 3: Brand, Therapeutic Area, Budget */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Brand Center *</label>
          <select className="input" {...register('brand', { required: 'Required' })}>
            <option value="">Select</option>
            {brands.filter(b => selectedDivisionId && b.divisions?.some(d => String(d.id) === String(selectedDivisionId))).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Therapeutic Area</label>
          <select className="input" {...register('therapeutic_area')}>
            <option value="">Select</option>
            {therapeutics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Budget</label>
          <select className="input" {...register('budget_type')}>
            <option value="">Select</option>
            {BUDGET_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Corporate Sponsorship specific */}
      {isSponsorship && (
        <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="label">Conference Type</label>
            <select className="input" {...register('conference_type')}><option value="">Select</option>{CONFERENCE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className="label">Solicited / Unsolicited</label>
            <select className="input" {...register('solicited_unsolicited')}><option value="">Select</option><option value="Solicited">Solicited</option><option value="Unsolicited">Unsolicited</option></select>
          </div>
          <div>
            <label className="label">Sponsorship Type</label>
            <select className="input" {...register('sponsorship_type')}><option value="">Select</option>{SPONSORSHIP_TYPES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div>
            <label className="label">Sponsorship Amount (₹)</label>
            <input type="number" className="input" {...register('sponsorship_amount')} />
          </div>
          <div>
            <label className="label">Advance Payment?</label>
            <select className="input" {...register('advance_payment')}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select>
          </div>
          {watch('advance_payment') === 'Yes' && (
            <div>
              <label className="label">Advance Amount (₹)</label>
              <input type="number" className="input" {...register('advance_payment_amount')} />
            </div>
          )}
        </div>
      )}

      {/* Topic for CME/Advisory */}
      {(isCME || isAdvisory) && (
        <div>
          <label className="label">Topic of Event</label>
          <input className="input" {...register('topic')} />
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary text-red-600 border-red-300" onClick={onCancel}>Cancel</button>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex items-center gap-1" disabled={saving} onClick={handleSubmit(d => onSave(d, false))}><Save size={14} /> Save Draft</button>
          <button type="submit" className="btn-primary" disabled={saving}>Next</button>
        </div>
      </div>
    </form>
  )
}
