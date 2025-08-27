import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Select, Space, Table, Tag, message, Modal, Checkbox } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/http'
import { exportCsvToExcel, exportToExcel } from '@/utils/exportExcel'

export default function OutboundsListPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [page, setPage] = useState({ page: 1, pageSize: 20, total: 0 })
  const [excelOpen, setExcelOpen] = useState<null | 'list' | 'detail'>(null)
  const outboundListFields = [
    { key: 'code', title: '单号' },
    { key: 'purpose', title: '用途' },
    { key: 'status', title: '状态' },
    { key: 'createdAt', title: '创建时间' },
  ]
  const outboundDetailFields = [
    { key: 'code', title: '单号' },
    { key: 'status', title: '状态' },
    { key: 'createdAt', title: '创建时间' },
    { key: 'purpose', title: '用途' },
    { key: 'materialCode', title: '物料' },
    { key: 'qty', title: '数量' },
    { key: 'batchPolicy', title: '批次策略' },
    { key: 'batchNo', title: '批次' },
  ]
  const [selListHeaders, setSelListHeaders] = useState<string[]>(outboundListFields.map(f=>f.key))
  const [selDetailHeaders, setSelDetailHeaders] = useState<string[]>(outboundDetailFields.map(f=>f.key))

  const load = async (params?: any) => {
    setLoading(true)
    try {
      const { data } = await api.get('/outbounds', { params: { page: page.page, pageSize: page.pageSize, ...(params||{}) } })
      setRows(data.data)
      setPage((p)=> ({ ...p, total: data.page?.total || data.total || 0 }))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  const navigate = useNavigate()


  const approve = async (code: string) => {
    await api.post(`/outbounds/${code}/approve`)
    message.success('已审批')
    load()
  }
  const pick = async (code: string) => {
    await api.post(`/outbounds/${code}/pick`)
    message.success('已拣货过账')
    load()
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Form form={form} layout="inline" onFinish={(v)=>{
          const q = { ...v } as any
          if (v.dateRange) {
            q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
            q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
          }
          delete q.dateRange
          setPage(p=> ({ ...p, page: 1 }))
          load({ ...q, page: 1, pageSize: page.pageSize })
        }} style={{ marginBottom: 12 }}>
          <Form.Item name="code"><Input placeholder="单号" allowClear /></Form.Item>
          <Form.Item name="status"><Select placeholder="状态" allowClear style={{ width: 140 }} options={[{value:'DRAFT',label:'DRAFT'},{value:'APPROVED',label:'APPROVED'},{value:'PICKED',label:'PICKED'},{value:'CANCELLED',label:'CANCELLED'}]} /></Form.Item>
          <Form.Item name="dateRange"><DatePicker.RangePicker /></Form.Item>
          <Form.Item><Button htmlType="submit" type="primary">查询</Button></Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={()=>{
                const v = form.getFieldsValue()
                const q: any = {}
                if (v.code) q.code = v.code
                if (v.status) q.status = v.status
                if (v.dateRange) {
                  q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
                  q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
                }
                const sp = new URLSearchParams(q).toString()
                window.open('/api/outbounds.csv' + (sp?`?${sp}`:''), '_blank')
              }}>导出 CSV</Button>
              <Button onClick={async()=>{
                const v = form.getFieldsValue()
                const q: any = {}
                if (v.code) q.code = v.code
                if (v.status) q.status = v.status
                if (v.dateRange) {
                  q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
                  q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
                }
                try {
                  const { data } = await api.get('/outbounds.csv', { params: q, responseType: 'text' })
                  exportCsvToExcel('出库列表.xlsx', data)
                } catch { message.error('导出失败') }
              }}>导出 Excel</Button>
              <Button onClick={()=> { setSelListHeaders(outboundListFields.map(f=>f.key)); setExcelOpen('list') }}>自定义 Excel</Button>
              <Button onClick={()=>{
                const v = form.getFieldsValue()
                const q: any = {}
                if (v.code) q.code = v.code
                if (v.status) q.status = v.status
                if (v.dateRange) {
                  q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
                  q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
                }
                const sp = new URLSearchParams(q).toString()
                window.open('/api/outbound-items.csv' + (sp?`?${sp}`:''), '_blank')
              }}>导出明细</Button>
              <Button onClick={async()=>{
                const v = form.getFieldsValue()
                const q: any = {}
                if (v.code) q.code = v.code
                if (v.status) q.status = v.status
                if (v.dateRange) {
                  q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
                  q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
                }
                try {
                  const { data } = await api.get('/outbound-items.csv', { params: q, responseType: 'text' })
                  exportCsvToExcel('出库明细.xlsx', data)
                } catch { message.error('导出失败') }
              }}>明细 Excel</Button>
              <Button onClick={()=> { setSelDetailHeaders(outboundDetailFields.map(f=>f.key)); setExcelOpen('detail') }}>自定义明细</Button>
              <Button onClick={()=> navigate('/outbound-new')}>新建出库</Button>
            </Space>
          </Form.Item>
        </Form>
        <Table rowKey="code" loading={loading} dataSource={rows} pagination={{
          current: page.page,
          pageSize: page.pageSize,
          total: page.total,
          showSizeChanger: true,
          onChange: (cp, ps)=> { setPage({ page: cp, pageSize: ps, total: page.total }); const v=form.getFieldsValue(); const q:any={}; if(v.code)q.code=v.code; if(v.status)q.status=v.status; if(v.dateRange){q.dateFrom=v.dateRange[0]?.format('YYYY-MM-DD'); q.dateTo=v.dateRange[1]?.format('YYYY-MM-DD')} load({ ...q, page: cp, pageSize: ps }) },
        }}
          columns={[
            { title: '单号', dataIndex: 'code', render: (v: string) => <Link to={`/outbounds/${v}`}>{v}</Link> },
            { title: '用途', dataIndex: 'purpose' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v==='DRAFT'?'default':v==='APPROVED'?'blue':'green'}>{v}</Tag> },
            { title: '明细数', dataIndex: 'items', render: (items: any[]) => items?.length || 0 },
            { title: '操作', render: (_: any, r: any) => (
              <Space>
                {r.status==='DRAFT' && <Button size="small" onClick={()=>approve(r.code)}>审批</Button>}
                {r.status==='APPROVED' && <Button size="small" type="primary" onClick={()=>pick(r.code)}>拣货过账</Button>}
              </Space>
            )}
          ]}
        />
      <Modal title={excelOpen==='list' ? '自定义出库列表导出' : '自定义出库明细导出'} open={!!excelOpen} onCancel={()=> setExcelOpen(null)} onOk={async()=>{
        const v = form.getFieldsValue()
        const q: any = {}
        if (v.code) q.code = v.code
        if (v.status) q.status = v.status
        if (v.dateRange) { q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD'); q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD') }
        try {
          if (excelOpen === 'list') {
            const { data } = await api.get('/outbounds', { params: { ...q, page: 1, pageSize: 10000 } })
            const rows = (data?.data||[]).map((r:any)=>{
              const obj: Record<string, any> = {}
              outboundListFields.filter(f=> selListHeaders.includes(f.key)).forEach(f=>{ obj[f.title] = r[f.key] })
              return obj
            })
            exportToExcel('出库列表-自定义.xlsx', rows)
          } else {
            const { data: csv } = await api.get('/outbound-items.csv', { params: q, responseType: 'text' })
            exportCsvToExcel('出库明细-自定义.xlsx', csv)
          }
        } catch { message.error('导出失败') } finally { setExcelOpen(null) }
      }}>
        {excelOpen==='list' ? (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（列表）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selListHeaders} onChange={(v)=> setSelListHeaders(v as string[])}>
              <Space direction="vertical">
                {outboundListFields.map(f=> <Checkbox key={f.key} value={f.key}>{f.title}</Checkbox>)}
              </Space>
            </Checkbox.Group>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（明细）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selDetailHeaders} onChange={(v)=> setSelDetailHeaders(v as string[])}>
              <Space direction="vertical">
                {outboundDetailFields.map(f=> <Checkbox key={f.key} value={f.key}>{f.title}</Checkbox>)}
              </Space>
            </Checkbox.Group>
          </>
        )}
      </Modal>
    </Space>
  )
}
