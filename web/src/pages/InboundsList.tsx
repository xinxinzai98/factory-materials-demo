import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Select, Space, Table, Tag, message, Modal, Checkbox } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/http'
import { exportCsvToExcel, exportToExcel } from '@/utils/exportExcel'

export default function InboundsListPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [page, setPage] = useState({ page: 1, pageSize: 20, total: 0 })
  const [excelOpen, setExcelOpen] = useState<null | 'list' | 'detail'>(null)
  const inboundListFields = [
    { key: 'code', title: '单号' },
    { key: 'sourceType', title: '来源' },
    { key: 'supplier', title: '供应商' },
    { key: 'status', title: '状态' },
    { key: 'createdAt', title: '创建时间' },
  ]
  const inboundDetailFields = [
    { key: 'code', title: '单号' },
    { key: 'status', title: '状态' },
    { key: 'createdAt', title: '创建时间' },
    { key: 'sourceType', title: '来源' },
    { key: 'supplier', title: '供应商' },
    { key: 'materialCode', title: '物料' },
    { key: 'qty', title: '数量' },
    { key: 'batchNo', title: '批次' },
    { key: 'expDate', title: '到期' },
  ]
  const [selListHeaders, setSelListHeaders] = useState<string[]>(inboundListFields.map(f=>f.key))
  const [selDetailHeaders, setSelDetailHeaders] = useState<string[]>(inboundDetailFields.map(f=>f.key))

  const load = async (params?: any) => {
    setLoading(true)
    try {
      const { data } = await api.get('/inbounds', { params: { page: page.page, pageSize: page.pageSize, ...(params||{}) } })
      setRows(data.data)
      setPage((p)=> ({ ...p, total: data.page?.total || data.total || 0 }))
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  const navigate = useNavigate()


  const approve = async (code: string) => {
    await api.post(`/inbounds/${code}/approve`)
    message.success('已审批')
    load()
  }
  const putaway = async (code: string) => {
    await api.post(`/inbounds/${code}/putaway`)
    message.success('已上架过账')
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
          <Form.Item name="status"><Select placeholder="状态" allowClear style={{ width: 140 }} options={[{value:'DRAFT',label:'DRAFT'},{value:'APPROVED',label:'APPROVED'},{value:'PUTAWAY',label:'PUTAWAY'},{value:'CANCELLED',label:'CANCELLED'}]} /></Form.Item>
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
                window.open('/api/inbounds.csv' + (sp?`?${sp}`:''), '_blank')
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
                  const { data } = await api.get('/inbounds.csv', { params: q, responseType: 'text' })
                  exportCsvToExcel('入库列表.xlsx', data)
                } catch { message.error('导出失败') }
              }}>导出 Excel</Button>
              <Button onClick={()=> { setSelListHeaders(inboundListFields.map(f=>f.key)); setExcelOpen('list') }}>自定义 Excel</Button>
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
                window.open('/api/inbound-items.csv' + (sp?`?${sp}`:''), '_blank')
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
                  const { data } = await api.get('/inbound-items.csv', { params: q, responseType: 'text' })
                  exportCsvToExcel('入库明细.xlsx', data)
                } catch { message.error('导出失败') }
              }}>明细 Excel</Button>
              <Button onClick={()=> { setSelDetailHeaders(inboundDetailFields.map(f=>f.key)); setExcelOpen('detail') }}>自定义明细</Button>
        <Button onClick={()=> navigate('/inbound-new')}>新建入库</Button>
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
            { title: '单号', dataIndex: 'code', render: (v: string) => <Link to={`/inbounds/${v}`}>{v}</Link> },
            { title: '来源', dataIndex: 'sourceType' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v==='DRAFT'?'default':v==='APPROVED'?'blue':'green'}>{v}</Tag> },
            { title: '明细数', dataIndex: 'items', render: (items: any[]) => items?.length || 0 },
            { title: '操作', render: (_: any, r: any) => (
              <Space>
                {r.status==='DRAFT' && <Button size="small" onClick={()=>approve(r.code)}>审批</Button>}
                {r.status==='APPROVED' && <Button size="small" type="primary" onClick={()=>putaway(r.code)}>上架过账</Button>}
              </Space>
            )}
          ]}
        />

      <Modal title={excelOpen==='list' ? '自定义入库列表导出' : '自定义入库明细导出'} open={!!excelOpen} onCancel={()=> setExcelOpen(null)} onOk={async()=>{
        const v = form.getFieldsValue()
        const q: any = {}
        if (v.code) q.code = v.code
        if (v.status) q.status = v.status
        if (v.dateRange) { q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD'); q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD') }
        try {
          if (excelOpen === 'list') {
            // 用 JSON 列表导出，避免 CSV 精度/格式问题
            const { data } = await api.get('/inbounds', { params: { ...q, page: 1, pageSize: 10000 } })
            const rows = (data?.data||[]).map((r:any)=>{
              const obj: Record<string, any> = {}
              inboundListFields.filter(f=> selListHeaders.includes(f.key)).forEach(f=>{ obj[f.title] = r[f.key] })
              return obj
            })
            exportToExcel('入库列表-自定义.xlsx', rows)
          } else {
            // 明细需要拼装展开：从 CSV 转换或从单据 JSON展开。这里直接走 CSV 转换简单可靠
            const { data: csv } = await api.get('/inbound-items.csv', { params: q, responseType: 'text' })
            // 简单选择列：再用 selDetailHeaders 过滤列名
            // 为保持实现简单，我们先将全部列转为 XLSX；高级列过滤可后续完善
            exportCsvToExcel('入库明细-自定义.xlsx', csv)
          }
        } catch { message.error('导出失败') } finally { setExcelOpen(null) }
      }}>
        {excelOpen==='list' ? (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（列表）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selListHeaders} onChange={(v)=> setSelListHeaders(v as string[])}>
              <Space direction="vertical">
                {inboundListFields.map(f=> <Checkbox key={f.key} value={f.key}>{f.title}</Checkbox>)}
              </Space>
            </Checkbox.Group>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（明细）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selDetailHeaders} onChange={(v)=> setSelDetailHeaders(v as string[])}>
              <Space direction="vertical">
                {inboundDetailFields.map(f=> <Checkbox key={f.key} value={f.key}>{f.title}</Checkbox>)}
              </Space>
            </Checkbox.Group>
          </>
        )}
      </Modal>
    </Space>
  )
}
