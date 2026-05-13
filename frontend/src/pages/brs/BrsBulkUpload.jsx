import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/client'
import PageHeader from '../../components/ui/PageHeader'

export default function BrsBulkUpload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/brs/bulk/template', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'brs_bulk_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Failed to download template')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/brs/bulk/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      toast.success(res.data.message)
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(detail || 'Upload failed')
      if (detail) {
        setResult({ errors: [{ row: '-', error: detail }], created: [] })
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/brs')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <PageHeader title="Bulk BRS Upload" subtitle="Create multiple BRS applications from an Excel file" />
      </div>

      {/* Instructions */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-700 mb-3">How it works</h3>
        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1.5">
          <li>Download the Excel template below</li>
          <li>Fill in BRS details — use <strong>survey name</strong> and <strong>division name</strong> (not IDs)</li>
          <li>For each doctor, enter their <strong>UID number</strong> from the MCL (Master Contact List)</li>
          <li>Doctor details (name, PAN, email, etc.) are auto-filled from the MCL — you only need the UID</li>
          <li>Multiple doctors for the same BRS: repeat the title + survey_title on each row</li>
          <li>If a doctor UID is not found in the system, that row is skipped with an error</li>
          <li>Upload the filled file and review the results</li>
        </ol>
        <button
          onClick={handleDownloadTemplate}
          className="mt-4 flex items-center gap-2 text-sm px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download size={16} /> Download Template
        </button>
      </div>

      {/* Upload area */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-700 mb-3">Upload Excel File</h3>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setFile(e.target.files[0]); setResult(null) }}
            className="hidden"
            id="bulk-file-input"
          />
          <label
            htmlFor="bulk-file-input"
            className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
          >
            Click to select file
          </label>
          <p className="text-xs text-gray-400 mt-1">Accepts .xlsx or .xls files</p>
          {file && (
            <div className="mt-3 inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm">
              <FileSpreadsheet size={14} />
              {file.name}
            </div>
          )}
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="mt-4 flex items-center gap-2 text-sm px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Upload size={16} />
          {uploading ? 'Uploading & Processing...' : 'Upload & Create BRS'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Success */}
          {result.created?.length > 0 && (
            <div className="card border-green-200 bg-green-50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-800">
                  {result.created.length} BRS Application(s) Created
                </h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-green-200">
                      <th className="text-left px-3 py-2 text-green-700">BRS Code</th>
                      <th className="text-left px-3 py-2 text-green-700">Title</th>
                      <th className="text-left px-3 py-2 text-green-700">Doctors</th>
                      <th className="text-left px-3 py-2 text-green-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.created.map((brs) => (
                      <tr key={brs.id} className="border-b border-green-100">
                        <td className="px-3 py-2 font-mono text-green-800">{brs.brs_code}</td>
                        <td className="px-3 py-2">{brs.title}</td>
                        <td className="px-3 py-2">{brs.doctor_count}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => navigate(`/brs/${brs.id}`)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors?.length > 0 && (
            <div className="card border-red-200 bg-red-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-red-800">
                  {result.errors.length} Error(s)
                </h3>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="text-sm text-red-700 flex gap-2">
                    <span className="font-mono text-red-500">Row {err.row}:</span>
                    <span>{err.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
