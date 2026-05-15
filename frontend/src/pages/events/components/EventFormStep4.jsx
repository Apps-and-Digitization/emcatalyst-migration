import { ChevronLeft, Upload, CheckCircle, Save, Trash2, Eye } from 'lucide-react'

export default function EventFormStep4({
  eventType, doctors, saving, eventId,
  preEventDocs, preDocUploads, setPreDocUploads,
  onSaveDraft, onSubmit, onBack, onPreview,
}) {
  return (
    <div className="card space-y-5">
      <h3 className="font-semibold text-lg">Pre-Event Documents</h3>
      <p className="text-xs text-gray-500">Upload required documents for this event type. Mandatory documents must be uploaded before submission.</p>

      {preEventDocs.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
          No pre-event document types configured for "{eventType}". You can save as draft or preview & submit.
        </div>
      ) : (
        <div className="space-y-3">
          {preEventDocs.map(docType => (
            <div key={docType.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{docType.name}</p>
                  {docType.is_mandatory && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Mandatory</span>}
                </div>
                {docType.code && <p className="text-xs text-gray-400">{docType.code}</p>}
              </div>
              <div className="flex items-center gap-2">
                {preDocUploads[docType.id] && (
                  <>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle size={14} />
                      <span className="text-xs truncate max-w-[150px]">{preDocUploads[docType.id].name}</span>
                    </div>
                    <button className="text-red-400 hover:text-red-600" onClick={() => setPreDocUploads(prev => { const n = {...prev}; delete n[docType.id]; return n })}>
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                  <Upload size={14} /> {preDocUploads[docType.id] ? 'Change' : 'Upload'}
                  <input type="file" className="hidden" onClick={e => { e.target.value = null }} onChange={e => {
                    if (e.target.files[0]) setPreDocUploads(prev => ({ ...prev, [docType.id]: e.target.files[0] }))
                  }} />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bg-[var(--color-primary-50)] rounded-lg p-4 text-sm text-[var(--color-primary-hover)] space-y-1">
        <p className="font-medium">Event Summary</p>
        <p>Type: {eventType || '—'} • {doctors.length} HCP(s) • {Object.keys(preDocUploads).length} doc(s) attached</p>
      </div>

      <div className="flex justify-between pt-2">
        <button className="btn-secondary" onClick={onBack}><ChevronLeft size={16} /> Back</button>
        <div className="flex gap-2">
          <button className="btn-secondary flex items-center gap-1" disabled={saving} onClick={onSaveDraft}>
            <Save size={14} /> Save Draft
          </button>
          <button className="btn-primary flex items-center gap-1" disabled={saving} onClick={onPreview}>
            <Eye size={14} /> Preview & Submit
          </button>
        </div>
      </div>
    </div>
  )
}
