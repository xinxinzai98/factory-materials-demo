import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/http'
import { Button, Card, Descriptions, Space, Table, Tag, message, Form, Input, InputNumber, Radio, Popconfirm, Tooltip, Select, Typography } from 'antd'

export default function OutboundDetailPage() {
  const { code } = useParams()
  const [data, setData] = useState<any>()
  const [form] = Form.useForm()
  const [editItems, setEditItems] = useState<any[]>([])
  const [batchOpts, setBatchOpts] = useState<Record<number, Array<{ value: string; label: string }>>>({})
  const rowErrors = React.useMemo(()=>{
    const errs: Record<number, Record<string, string>> = {}
    editItems.forEach((it, idx)=>{
      const e: Record<string, string> = {}
      if (!it.materialCode?.trim()) e.materialCode = '物料必填'
      if (!(Number(it.qty)>0)) e.qty = '数量必须>0'
      if ((it.batchPolicy||'SYSTEM')==='SPECIFIED' && !it.batchNo?.trim()) e.batchNo = '指定批次时必须填写批次'
      if (Object.keys(e).length) errs[idx] = e
    })
    return errs
  }, [editItems])
  const hasErrors = Object.keys(rowErrors).length>0
  const load = async () => {
    const resp = await api.get(`/orders/${code}`)
    setData(resp.data.order)
    if (resp.data.order?.status === 'DRAFT') {
      setEditItems((resp.data.order.items||[]).map((it:any)=>({ materialCode: it.material?.code || it.materialId, qty: Number(it.qty), batchPolicy: it.batchPolicy || 'SYSTEM', batchNo: it.batchNo || '' })))
    } else { setEditItems([]) }
  }
  useEffect(() => { load() }, [code])

  const approve = async () => { await api.post(`/outbounds/${code}/approve`); message.success('已审批'); load() }
  const pick = async () => { await api.post(`/outbounds/${code}/pick`); message.success('已拣货过账'); load() }
  const cancel = async () => { await api.post(`/outbounds/${code}/cancel`); message.success('已取消'); load() }
  const addItem = (v:any) => setEditItems(prev=> [...prev, v])
  const removeItem = (idx:number) => setEditItems(prev=> prev.filter((_v,_i)=> _i!==idx))
  const fetchBatchOptions = async (rowIndex: number, materialCode?: string) => {
    const mc = (materialCode || '').trim()
    const wh = 'WH1'
    if (!mc) { setBatchOpts(prev=> ({ ...prev, [rowIndex]: [] })); return }
    try {
      const { data } = await api.get('/stocks', { params: { materialCode: mc, warehouse: wh } })
      const rows = Array.isArray(data) ? data : []
      rows.sort((a:any,b:any)=>{
        const ax = a.expDate? new Date(a.expDate).getTime(): Number.MAX_SAFE_INTEGER
        const bx = b.expDate? new Date(b.expDate).getTime(): Number.MAX_SAFE_INTEGER
        return ax - bx
      })
      const opts = rows
        .filter((r:any)=> Number((r.qtyAvailable ?? (Number(r.qtyOnHand)-Number(r.qtyAllocated)))) > 0)
        .map((r:any)=> ({ value: r.batchNo || '', label: `${r.batchNo || '(空批次)'} | 到期:${r.expDate? String(r.expDate).slice(0,10):'-'} | 可用:${r.qtyAvailable ?? (Number(r.qtyOnHand)-Number(r.qtyAllocated))}` }))
      setBatchOpts(prev=> ({ ...prev, [rowIndex]: opts }))
    } catch { setBatchOpts(prev=> ({ ...prev, [rowIndex]: [] })) }
  }
  const saveDraft = async ()=> {
    try {
  if (!editItems.length) return message.warning('请先添加至少一行明细')
  if (hasErrors) return message.error('明细存在校验错误，请先修正后再保存草稿')
  await api.put(`/outbounds/${code}`, { items: editItems })
      message.success('草稿已保存')
      load()
    } catch(e:any) { message.error(e?.response?.data?.message || e?.message || '保存失败') }
  }

  if (!data) return null
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
  <Card className="glass-card" title={`出库单 ${code}`} extra={<Tag color={data.status==='DRAFT'?'default':data.status==='APPROVED'?'blue':data.status==='PICKED'?'green':'red'}>{data.status}</Tag>}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="用途">{data.purpose}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>
          {data.status==='DRAFT' && <Button onClick={approve}>审批</Button>}
          {data.status==='APPROVED' && <Button type="primary" onClick={pick} style={{ marginLeft: 8 }}>拣货过账</Button>}
          {(data.status==='DRAFT' || data.status==='APPROVED') && <Button danger onClick={cancel} style={{ marginLeft: 8 }}>取消</Button>}
        </div>
      </Card>
  {data.status==='DRAFT' ? (
      <Card className="glass-card" title="草稿编辑">
        <Form layout="inline" onFinish={addItem} initialValues={{ batchPolicy: 'SYSTEM' }}>
          <Form.Item name="materialCode" rules={[{ required: true }]}><Input placeholder="物料编码" /></Form.Item>
          <Form.Item name="qty" rules={[{ required: true }]}><InputNumber placeholder="数量" min={0} /></Form.Item>
          <Form.Item name="batchPolicy"><Radio.Group options={[{label:'系统策略',value:'SYSTEM'},{label:'指定批次',value:'SPECIFIED'}]} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(prev,cur)=> prev.batchPolicy !== cur.batchPolicy}>
            {({ getFieldValue }) => (
              <Form.Item name="batchNo" rules={getFieldValue('batchPolicy')==='SPECIFIED'?[{ required: true, message: '指定批次策略时必须填写批次' }]:[] }>
                <Input placeholder={getFieldValue('batchPolicy')==='SYSTEM'? '系统策略下由系统自动选择批次':'批次（指定批次时填写）'} disabled={getFieldValue('batchPolicy')==='SYSTEM'} />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item><Button htmlType="submit">添加</Button></Form.Item>
          <Form.Item><Button onClick={saveDraft} type="primary">保存草稿</Button></Form.Item>
        </Form>
        <Table rowKey={(_r:any,i?:number)=> String(i ?? Math.random())} dataSource={editItems} pagination={false} style={{marginTop:12}}
          columns={[
            { title:'物料', dataIndex:'materialCode', render: (_v:any,_r:any,i:number)=> (
              <div>
                <Input status={rowErrors[i]?.materialCode?'error':undefined} value={editItems[i]?.materialCode} onChange={(e)=> setEditItems(prev=> prev.map((it,j)=> j===i? { ...it, materialCode: e.target.value }: it))} />
                {rowErrors[i]?.materialCode && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[i].materialCode}</div>}
              </div>
            ) },
            { title:'数量', dataIndex:'qty', render: (_v:any,_r:any,i:number)=> (
              <div>
                <InputNumber status={rowErrors[i]?.qty?'error':undefined} min={0.0001} value={editItems[i]?.qty} onChange={(val)=> setEditItems(prev=> prev.map((it,j)=> j===i? { ...it, qty: Number(val||0) }: it))} />
                {rowErrors[i]?.qty && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[i].qty}</div>}
              </div>
            ) },
            { title:'策略', dataIndex:'batchPolicy', render: (_v:any,_r:any,i:number)=> (
              <Radio.Group value={editItems[i]?.batchPolicy || 'SYSTEM'} onChange={(e)=> setEditItems(prev=> prev.map((it,j)=> j===i? { ...it, batchPolicy: e.target.value }: it))}
                options={[{label:'系统策略',value:'SYSTEM'},{label:'指定批次',value:'SPECIFIED'}]} />
            ) },
            { title:'批次', dataIndex:'batchNo', render: (_v:any,_r:any,i:number)=> {
              const isSystem = (editItems[i]?.batchPolicy || 'SYSTEM')==='SYSTEM'
              const input = isSystem ? (
                <Input status={rowErrors[i]?.batchNo?'error':undefined} value={editItems[i]?.batchNo} disabled placeholder={'系统策略下由系统自动选择批次'} />
              ) : (
                <Select
                  showSearch
                  value={editItems[i]?.batchNo}
                  placeholder="选择批次（基于可用库存）"
                  options={batchOpts[i] || []}
                  onDropdownVisibleChange={(open)=>{ if (open) fetchBatchOptions(i, editItems[i]?.materialCode) }}
                  onChange={(v)=> setEditItems(prev=> prev.map((it,j)=> j===i? { ...it, batchNo: v as any }: it))}
                  style={{ minWidth: 280 }}
                  status={rowErrors[i]?.batchNo?'error':undefined as any}
                />
              )
              return (
                <div>
                  {rowErrors[i]?.batchNo ? (<Tooltip title={rowErrors[i].batchNo}>{input}</Tooltip>) : input}
                  {rowErrors[i]?.batchNo && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[i].batchNo}</div>}
                </div>
              )
            } },
            { title:'操作', render: (_:any,_r:any,i:number)=> (
              <Popconfirm title="删除该行?" onConfirm={()=> removeItem(i)}><a>删除</a></Popconfirm>
            )}
          ]}
        />
      </Card>
    ) : (
      <Card className="glass-card" title="明细">
        <Table rowKey="id" dataSource={data.items||[]} pagination={false}
          columns={[
            { title:'物料', dataIndex:'materialId' },
            { title:'数量', dataIndex:'qty' },
            { title:'策略', dataIndex:'batchPolicy' },
            { title:'批次', dataIndex:'batchNo' },
          ]}
        />
      </Card>
    )}
    </Space>
  )
}
