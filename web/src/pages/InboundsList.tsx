import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Select, Space, Table, Tag, message, Modal, Checkbox, Input as AntInput, Divider } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/http'
import { exportCsvToExcel, exportToExcel } from '@/utils/exportExcel'
import { listTemplates, upsertTemplate, removeTemplate, renameTemplate } from '@/utils/exportTemplates'

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
  // 列表与明细分开管理：列表使用 inbound-list 作用域，明细使用 inbound-detail 作用域
  const [headerMapList, setHeaderMapList] = useState<Record<string,string>>({})
  const [headerMap, setHeaderMap] = useState<Record<string,string>>({})
  const [tplNameList, setTplNameList] = useState('')
  const [tplName, setTplName] = useState('')
  const [tplListList, setTplListList] = useState(()=> listTemplates('inbound-list'))
  const [tplList, setTplList] = useState(()=> listTemplates('inbound-detail'))

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
            // 用 JSON 列表导出，支持“选择顺序”与“自定义列头”
            const { data } = await api.get('/inbounds', { params: { ...q, page: 1, pageSize: 10000 } })
            let keys = inboundListFields.map(f=>f.key).filter(k=> selListHeaders.includes(k))
            keys = selListHeaders.filter(k=> keys.includes(k))
            const rows = (data?.data||[]).map((r:any)=>{
              const obj: Record<string, any> = {}
              keys.forEach(k=>{
                const title = headerMapList[k] || inboundListFields.find(f=> f.key===k)?.title || k
                obj[title] = r[k]
              })
              return obj
            })
            exportToExcel('入库列表-自定义.xlsx', rows)
          } else {
            const { data } = await api.get('/inbound-items', { params: q })
            let keys = inboundDetailFields.map(f=>f.key).filter(k=> selDetailHeaders.includes(k))
            // 应用自定义顺序
            keys = selDetailHeaders.filter(k=> keys.includes(k))
            const rows = (data||[]).map((r:any)=>{
              const obj: Record<string, any> = {}
              keys.forEach(k=>{
                const title = headerMap[k] || inboundDetailFields.find(f=> f.key===k)?.title || k
                obj[title] = r[k]
              })
              return obj
            })
            exportToExcel('入库明细-自定义.xlsx', rows)
          }
        } catch { message.error('导出失败') } finally { setExcelOpen(null) }
      }}>
        {excelOpen==='list' ? (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（列表）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selListHeaders} onChange={(v)=> setSelListHeaders(v as string[])}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {inboundListFields.map(f=> (
                  <div key={f.key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Checkbox value={f.key}>{f.title}</Checkbox>
                    {selListHeaders.includes(f.key) && (
                      <Space size={4}>
                        <Button size="small" onClick={()=>{
                          const idx = selListHeaders.indexOf(f.key); if (idx>0) {
                            const arr = [...selListHeaders]; [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]]; setSelListHeaders(arr)
                          }
                        }}>上移</Button>
                        <Button size="small" onClick={()=>{
                          const idx = selListHeaders.indexOf(f.key); if (idx>=0 && idx < selListHeaders.length-1) {
                            const arr = [...selListHeaders]; [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]]; setSelListHeaders(arr)
                          }
                        }}>下移</Button>
                      </Space>
                    )}
                  </div>
                ))}
              </Space>
            </Checkbox.Group>
            <Divider />
            <div style={{ marginBottom: 8 }}>列名自定义（留空则使用默认名）：</div>
            <Space direction="vertical" style={{ width: '100%' }}>
              {inboundListFields.filter(f=> selListHeaders.includes(f.key)).map(f=> (
                <div key={f.key} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 120, lineHeight: '32px' }}>{f.title}</div>
                  <AntInput placeholder={`自定义列名（默认：${f.title}）`} value={headerMapList[f.key]||''} onChange={e=> setHeaderMapList(h=> ({ ...h, [f.key]: e.target.value }))} />
                </div>
              ))}
            </Space>
            <Divider />
            <Space wrap>
              <AntInput placeholder="保存为方案名称" value={tplNameList} onChange={e=> setTplNameList(e.target.value)} style={{ width: 200 }} />
              <Button onClick={()=>{ if(!tplNameList.trim()) { message.warning('请输入方案名称'); return } upsertTemplate('inbound-list', tplNameList.trim(), selListHeaders, headerMapList); setTplListList(listTemplates('inbound-list')); message.success('已保存导出方案') }}>保存方案</Button>
              {tplListList.length>0 && <Select placeholder="加载方案" style={{ width: 220 }} options={tplListList.map(t=> ({ label: t.name, value: t.name }))} onChange={(name)=>{ const t = listTemplates('inbound-list').find(x=> x.name===name); if(!t) return; setTplNameList(name); setSelListHeaders(t.keys); setHeaderMapList(t.headerMap||{}); }} />}
              {tplListList.length>0 && <Button onClick={()=>{ const t = listTemplates('inbound-list').find(x=> x.name===tplNameList.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const nn = prompt('重命名为：', t.name); if(!nn) return; renameTemplate('inbound-list', t.name, nn.trim()); setTplNameList(nn.trim()); setTplListList(listTemplates('inbound-list')); message.success('已重命名'); }}>重命名</Button>}
              {tplListList.length>0 && <Button onClick={()=>{ const t = listTemplates('inbound-list').find(x=> x.name===tplNameList.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const preview = (t.keys||[]).map(k=> headerMapList[k] || inboundListFields.find(f=> f.key===k)?.title || k).join(' , '); Modal.info({ title: '列头预览', content: <div style={{whiteSpace:'pre-wrap'}}>{preview}</div> }) }}>预览列头</Button>}
              {tplListList.length>0 && <Button danger onClick={()=>{ if(!tplNameList.trim()) { message.warning('请输入要删除的方案名称'); return } removeTemplate('inbound-list', tplNameList.trim()); setTplListList(listTemplates('inbound-list')); message.success('已删除'); }}>删除方案</Button>}
            </Space>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（明细）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selDetailHeaders} onChange={(v)=> setSelDetailHeaders(v as string[])}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {inboundDetailFields.map(f=> (
                  <div key={f.key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Checkbox value={f.key}>{f.title}</Checkbox>
                    {selDetailHeaders.includes(f.key) && (
                      <Space size={4}>
                        <Button size="small" onClick={()=>{
                          const idx = selDetailHeaders.indexOf(f.key); if (idx>0) {
                            const arr = [...selDetailHeaders]; [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]]; setSelDetailHeaders(arr)
                          }
                        }}>上移</Button>
                        <Button size="small" onClick={()=>{
                          const idx = selDetailHeaders.indexOf(f.key); if (idx>=0 && idx < selDetailHeaders.length-1) {
                            const arr = [...selDetailHeaders]; [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]]; setSelDetailHeaders(arr)
                          }
                        }}>下移</Button>
                      </Space>
                    )}
                  </div>
                ))}
              </Space>
            </Checkbox.Group>
            <Divider />
            <div style={{ marginBottom: 8 }}>列名自定义（留空则使用默认名）：</div>
            <Space direction="vertical" style={{ width: '100%' }}>
              {inboundDetailFields.filter(f=> selDetailHeaders.includes(f.key)).map(f=> (
                <div key={f.key} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 120, lineHeight: '32px' }}>{f.title}</div>
                  <AntInput placeholder={`自定义列名（默认：${f.title}）`} value={headerMap[f.key]||''} onChange={e=> setHeaderMap(h=> ({ ...h, [f.key]: e.target.value }))} />
                </div>
              ))}
            </Space>
            <Divider />
            <Space wrap>
              <AntInput placeholder="保存为方案名称" value={tplName} onChange={e=> setTplName(e.target.value)} style={{ width: 200 }} />
              <Button onClick={()=>{ if(!tplName.trim()) { message.warning('请输入方案名称'); return } upsertTemplate('inbound-detail', tplName.trim(), selDetailHeaders, headerMap); setTplList(listTemplates('inbound-detail')); message.success('已保存导出方案') }}>保存方案</Button>
              {tplList.length>0 && <Select placeholder="加载方案" style={{ width: 220 }} options={tplList.map(t=> ({ label: t.name, value: t.name }))} onChange={(name)=>{ const t = listTemplates('inbound-detail').find(x=> x.name===name); if(!t) return; setTplName(name); setSelDetailHeaders(t.keys); setHeaderMap(t.headerMap||{}); }} />}
              {tplList.length>0 && <Button onClick={()=>{ const t = listTemplates('inbound-detail').find(x=> x.name===tplName.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const nn = prompt('重命名为：', t.name); if(!nn) return; renameTemplate('inbound-detail', t.name, nn.trim()); setTplName(nn.trim()); setTplList(listTemplates('inbound-detail')); message.success('已重命名'); }}>重命名</Button>}
              {tplList.length>0 && <Button onClick={()=>{ const t = listTemplates('inbound-detail').find(x=> x.name===tplName.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const preview = (t.keys||[]).map(k=> headerMap[k] || inboundDetailFields.find(f=> f.key===k)?.title || k).join(' , '); Modal.info({ title: '列头预览', content: <div style={{whiteSpace:'pre-wrap'}}>{preview}</div> }) }}>预览列头</Button>}
              {tplList.length>0 && <Button danger onClick={()=>{ if(!tplName.trim()) { message.warning('请输入要删除的方案名称'); return } removeTemplate('inbound-detail', tplName.trim()); setTplList(listTemplates('inbound-detail')); message.success('已删除'); }}>删除方案</Button>}
            </Space>
          </>
        )}
      </Modal>
    </Space>
  )
}
