import { useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, Select, Space, Table, Tag, message, Modal, Checkbox, Input as AntInput, Divider } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/api/http'
import { exportCsvToExcel, exportToExcel } from '@/utils/exportExcel'
import { tsSuffix } from '@/utils/time'
import { listTemplates, upsertTemplate, removeTemplate, renameTemplate, listRemoteTemplates, upsertRemoteTemplate, removeRemoteTemplate, renameRemoteTemplate, mergeLocalWithRemote } from '@/utils/exportTemplates'

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
  // 列表与明细分开管理
  const [headerMapList, setHeaderMapList] = useState<Record<string,string>>({})
  const [headerMap, setHeaderMap] = useState<Record<string,string>>({})
  const [tplNameList, setTplNameList] = useState('')
  const [tplName, setTplName] = useState('')
  const [tplListList, setTplListList] = useState(()=> listTemplates('outbound-list'))
  const [tplList, setTplList] = useState(()=> listTemplates('outbound-detail'))
  // 共享模板（服务端）
  const role = (localStorage.getItem('role') || 'VIEWER') as 'ADMIN'|'OP'|'VIEWER'
  const canWriteShared = role==='ADMIN' || role==='OP'
  const [rTplListList, setRTplListList] = useState<Array<{ name: string; keys: string[]; headerMap?: Record<string,string> }>>([])
  const [rTplList, setRTplList] = useState<Array<{ name: string; keys: string[]; headerMap?: Record<string,string> }>>([])
  const refreshRemote = async ()=> {
    try {
      const [a,b] = await Promise.all([
        listRemoteTemplates('outbound-list'),
        listRemoteTemplates('outbound-detail'),
      ])
      setRTplListList(a||[]); setRTplList(b||[])
    } catch {}
  }

  const load = async (params?: any) => {
    setLoading(true)
    try {
      const { data } = await api.get('/outbounds', { params: { page: page.page, pageSize: page.pageSize, ...(params||{}) } })
      setRows(data.data)
      setPage((p)=> ({ ...p, total: data.page?.total || data.total || 0 }))
    } finally { setLoading(false) }
  }

  useEffect(() => { load(); void refreshRemote() }, [])
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
                const sp = new URLSearchParams({ ...q, filename: `outbounds-${tsSuffix()}.csv` }).toString()
                window.open('/api/outbounds.csv?' + sp, '_blank')
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
                  const { data } = await api.get('/outbounds.csv', { params: { ...q, filename: `outbounds-${tsSuffix()}.csv` }, responseType: 'text' })
                  await exportCsvToExcel('出库列表.xlsx', data)
                } catch { message.error('导出失败') }
              }}>导出 Excel</Button>
              <Button onClick={()=> { setSelListHeaders(outboundListFields.map(f=>f.key)); setExcelOpen('list'); void import('xlsx').catch(()=>{}) }}>自定义 Excel</Button>
              <Button onClick={()=>{
                const v = form.getFieldsValue()
                const q: any = {}
                if (v.code) q.code = v.code
                if (v.status) q.status = v.status
                if (v.dateRange) {
                  q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
                  q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
                }
                const sp = new URLSearchParams({ ...q, filename: `outbound-items-${tsSuffix()}.csv` }).toString()
                window.open('/api/outbound-items.csv?' + sp, '_blank')
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
                  const { data } = await api.get('/outbound-items.csv', { params: { ...q, filename: `outbound-items-${tsSuffix()}.csv` }, responseType: 'text' })
                  await exportCsvToExcel('出库明细.xlsx', data)
                } catch { message.error('导出失败') }
              }}>明细 Excel</Button>
              <Button onClick={()=> { setSelDetailHeaders(outboundDetailFields.map(f=>f.key)); setExcelOpen('detail'); void import('xlsx').catch(()=>{}) }}>自定义明细</Button>
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
            let keys = outboundListFields.map(f=>f.key).filter(k=> selListHeaders.includes(k))
            keys = selListHeaders.filter(k=> keys.includes(k))
            const rows = (data?.data||[]).map((r:any)=>{
              const obj: Record<string, any> = {}
              keys.forEach(k=>{
                const title = headerMapList[k] || outboundListFields.find(f=> f.key===k)?.title || k
                obj[title] = r[k]
              })
              return obj
            })
            await exportToExcel(`出库列表-自定义-${tsSuffix()}.xlsx`, rows)
          } else {
            const { data } = await api.get('/outbound-items', { params: q })
            let keys = outboundDetailFields.map(f=>f.key).filter(k=> selDetailHeaders.includes(k))
            keys = selDetailHeaders.filter(k=> keys.includes(k))
            const rows = (data||[]).map((r:any)=>{
              const obj: Record<string, any> = {}
              keys.forEach(k=>{
                const title = headerMap[k] || outboundDetailFields.find(f=> f.key===k)?.title || k
                obj[title] = r[k]
              })
              return obj
            })
            await exportToExcel(`出库明细-自定义-${tsSuffix()}.xlsx`, rows)
          }
        } catch { message.error('导出失败') } finally { setExcelOpen(null) }
      }}>
        {excelOpen==='list' ? (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（列表）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selListHeaders} onChange={(v)=> setSelListHeaders(v as string[])}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {outboundListFields.map(f=> (
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
              {outboundListFields.filter(f=> selListHeaders.includes(f.key)).map(f=> (
                <div key={f.key} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 120, lineHeight: '32px' }}>{f.title}</div>
                  <AntInput placeholder={`自定义列名（默认：${f.title}）`} value={headerMapList[f.key]||''} onChange={e=> setHeaderMapList(h=> ({ ...h, [f.key]: e.target.value }))} />
                </div>
              ))}
            </Space>
            <Divider />
            <Space wrap>
              <AntInput placeholder="保存为方案名称" value={tplNameList} onChange={e=> setTplNameList(e.target.value)} style={{ width: 200 }} />
              <Button onClick={()=>{ if(!tplNameList.trim()) { message.warning('请输入方案名称'); return } upsertTemplate('outbound-list', tplNameList.trim(), selListHeaders, headerMapList); setTplListList(listTemplates('outbound-list')); message.success('已保存导出方案') }}>保存方案</Button>
              {tplListList.length>0 && <Select placeholder="加载方案" style={{ width: 220 }} options={tplListList.map(t=> ({ label: t.name, value: t.name }))} onChange={(name)=>{ const t = listTemplates('outbound-list').find(x=> x.name===name); if(!t) return; setTplNameList(name); setSelListHeaders(t.keys); setHeaderMapList(t.headerMap||{}); }} />}
              {tplListList.length>0 && <Button onClick={()=>{ const t = listTemplates('outbound-list').find(x=> x.name===tplNameList.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const nn = prompt('重命名为：', t.name); if(!nn) return; renameTemplate('outbound-list', t.name, nn.trim()); setTplNameList(nn.trim()); setTplListList(listTemplates('outbound-list')); message.success('已重命名'); }}>重命名</Button>}
              {tplListList.length>0 && <Button onClick={()=>{ const t = listTemplates('outbound-list').find(x=> x.name===tplNameList.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const preview = (t.keys||[]).map(k=> headerMapList[k] || outboundListFields.find(f=> f.key===k)?.title || k).join(' , '); Modal.info({ title: '列头预览', content: <div style={{whiteSpace:'pre-wrap'}}>{preview}</div> }) }}>预览列头</Button>}
              {tplListList.length>0 && <Button danger onClick={()=>{ if(!tplNameList.trim()) { message.warning('请输入要删除的方案名称'); return } removeTemplate('outbound-list', tplNameList.trim()); setTplListList(listTemplates('outbound-list')); message.success('已删除'); }}>删除方案</Button>}
              {/* 共享模板（列表） */}
              <Divider type="vertical" />
              <Select placeholder="加载共享方案" style={{ width: 220 }} options={rTplListList.map(t=> ({ label: t.name, value: t.name }))} onDropdownVisibleChange={(open)=>{ if(open) void refreshRemote() }} onChange={(name)=>{ const t = rTplListList.find(x=> x.name===name); if(!t) return; setTplNameList(name); setSelListHeaders(t.keys||[]); setHeaderMapList(t.headerMap||{}); }} />
              {canWriteShared && <Button onClick={async()=>{ if(!tplNameList.trim()) { message.warning('请输入方案名称'); return } try { await upsertRemoteTemplate('outbound-list', tplNameList.trim(), selListHeaders, headerMapList); await refreshRemote(); message.success('已保存到共享'); } catch { message.error('保存共享失败') } }}>保存为共享</Button>}
              {canWriteShared && rTplListList.length>0 && <Button onClick={async()=>{ const name = tplNameList.trim(); if(!name) { message.warning('请输入/选择方案名称'); return } try { const nn = prompt('共享方案重命名为：', name); if(!nn) return; await renameRemoteTemplate('outbound-list', name, nn.trim()); setTplNameList(nn.trim()); await refreshRemote(); message.success('已重命名'); } catch { message.error('重命名失败') } }}>共享重命名</Button>}
              {canWriteShared && rTplListList.length>0 && <Button danger onClick={async()=>{ const name = tplNameList.trim(); if(!name) { message.warning('请输入要删除的方案名称'); return } try { await removeRemoteTemplate('outbound-list', name); await refreshRemote(); message.success('已删除共享方案') } catch { message.error('删除失败') } }}>删除共享</Button>}
              <Button onClick={async()=>{ await mergeLocalWithRemote('outbound-list'); setTplListList(listTemplates('outbound-list')); message.success('已将共享合并到本地'); }}>合并到本地</Button>
            </Space>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>选择导出字段（明细）：</div>
            <Checkbox.Group style={{ width: '100%' }} value={selDetailHeaders} onChange={(v)=> setSelDetailHeaders(v as string[])}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {outboundDetailFields.map(f=> (
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
              {outboundDetailFields.filter(f=> selDetailHeaders.includes(f.key)).map(f=> (
                <div key={f.key} style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 120, lineHeight: '32px' }}>{f.title}</div>
                  <AntInput placeholder={`自定义列名（默认：${f.title}）`} value={headerMap[f.key]||''} onChange={e=> setHeaderMap(h=> ({ ...h, [f.key]: e.target.value }))} />
                </div>
              ))}
            </Space>
            <Divider />
            <Space wrap>
              <AntInput placeholder="保存为方案名称" value={tplName} onChange={e=> setTplName(e.target.value)} style={{ width: 200 }} />
              <Button onClick={()=>{ if(!tplName.trim()) { message.warning('请输入方案名称'); return } upsertTemplate('outbound-detail', tplName.trim(), selDetailHeaders, headerMap); setTplList(listTemplates('outbound-detail')); message.success('已保存导出方案') }}>保存方案</Button>
              {tplList.length>0 && <Select placeholder="加载方案" style={{ width: 220 }} options={tplList.map(t=> ({ label: t.name, value: t.name }))} onChange={(name)=>{ const t = listTemplates('outbound-detail').find(x=> x.name===name); if(!t) return; setTplName(name); setSelDetailHeaders(t.keys); setHeaderMap(t.headerMap||{}); }} />}
              {tplList.length>0 && <Button onClick={()=>{ const t = listTemplates('outbound-detail').find(x=> x.name===tplName.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const nn = prompt('重命名为：', t.name); if(!nn) return; renameTemplate('outbound-detail', t.name, nn.trim()); setTplName(nn.trim()); setTplList(listTemplates('outbound-detail')); message.success('已重命名'); }}>重命名</Button>}
              {tplList.length>0 && <Button onClick={()=>{ const t = listTemplates('outbound-detail').find(x=> x.name===tplName.trim()); if(!t) { message.warning('请先选择或输入方案名称'); return } const preview = (t.keys||[]).map(k=> headerMap[k] || outboundDetailFields.find(f=> f.key===k)?.title || k).join(' , '); Modal.info({ title: '列头预览', content: <div style={{whiteSpace:'pre-wrap'}}>{preview}</div> }) }}>预览列头</Button>}
              {tplList.length>0 && <Button danger onClick={()=>{ if(!tplName.trim()) { message.warning('请输入要删除的方案名称'); return } removeTemplate('outbound-detail', tplName.trim()); setTplList(listTemplates('outbound-detail')); message.success('已删除'); }}>删除方案</Button>}
              {/* 共享模板（明细） */}
              <Divider type="vertical" />
              <Select placeholder="加载共享方案" style={{ width: 220 }} options={rTplList.map(t=> ({ label: t.name, value: t.name }))} onDropdownVisibleChange={(open)=>{ if(open) void refreshRemote() }} onChange={(name)=>{ const t = rTplList.find(x=> x.name===name); if(!t) return; setTplName(name); setSelDetailHeaders(t.keys||[]); setHeaderMap(t.headerMap||{}); }} />
              {canWriteShared && <Button onClick={async()=>{ if(!tplName.trim()) { message.warning('请输入方案名称'); return } try { await upsertRemoteTemplate('outbound-detail', tplName.trim(), selDetailHeaders, headerMap); await refreshRemote(); message.success('已保存到共享'); } catch { message.error('保存共享失败') } }}>保存为共享</Button>}
              {canWriteShared && rTplList.length>0 && <Button onClick={async()=>{ const name = tplName.trim(); if(!name) { message.warning('请输入/选择方案名称'); return } try { const nn = prompt('共享方案重命名为：', name); if(!nn) return; await renameRemoteTemplate('outbound-detail', name, nn.trim()); setTplName(nn.trim()); await refreshRemote(); message.success('已重命名'); } catch { message.error('重命名失败') } }}>共享重命名</Button>}
              {canWriteShared && rTplList.length>0 && <Button danger onClick={async()=>{ const name = tplName.trim(); if(!name) { message.warning('请输入要删除的方案名称'); return } try { await removeRemoteTemplate('outbound-detail', name); await refreshRemote(); message.success('已删除共享方案') } catch { message.error('删除失败') } }}>删除共享</Button>}
              <Button onClick={async()=>{ await mergeLocalWithRemote('outbound-detail'); setTplList(listTemplates('outbound-detail')); message.success('已将共享合并到本地'); }}>合并到本地</Button>
            </Space>
          </>
        )}
      </Modal>
    </Space>
  )
}
