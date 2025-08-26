import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/http'
import { Button, Card, Descriptions, Space, Table, Tag, message, Form, Input, DatePicker, InputNumber, Popconfirm, AutoComplete, Typography } from 'antd'
import dayjs from 'dayjs'

export default function InboundDetailPage() {
  const { code } = useParams()
  const [data, setData] = useState<any>()
  const [form] = Form.useForm()
  const [editItems, setEditItems] = useState<any[]>([])
  const [addBatchOpts, setAddBatchOpts] = useState<Array<{ value: string }>>([])
  const [rowBatchOpts, setRowBatchOpts] = useState<Record<number, Array<{ value: string }>>>({})
  const rowErrors = React.useMemo(()=>{
    const errs: Record<number, Record<string, string>> = {}
    const today = dayjs().startOf('day')
    editItems.forEach((it, idx)=>{
      const e: Record<string, string> = {}
      if (!it.materialCode?.trim()) e.materialCode = '物料必填'
      if (!(Number(it.qty)>0)) e.qty = '数量必须>0'
      if (it.expDate) {
        const d = dayjs(it.expDate).startOf('day')
        if (d.isBefore(today)) e.expDate = '到期日不能早于今天'
      }
      if (Object.keys(e).length) errs[idx] = e
    })
    return errs
  }, [editItems])
  const hasErrors = Object.keys(rowErrors).length>0
  const load = async () => {
    const resp = await api.get(`/orders/${code}`)
    setData(resp.data.order)
    if (resp.data.order?.status === 'DRAFT') {
      form.setFieldsValue({ supplier: resp.data.order.supplier, arriveDate: resp.data.order.arriveDate ? dayjs(resp.data.order.arriveDate) : null })
      setEditItems((resp.data.order.items||[]).map((it:any)=>({ materialCode: it.material?.code || it.materialId, qty: Number(it.qty), batchNo: it.batchNo || '', expDate: it.expDate || null, uprice: it.uprice?Number(it.uprice):undefined })))
    } else {
      setEditItems([])
      form.resetFields()
    }
  }
  useEffect(() => { load() }, [code])

  const approve = async () => { await api.post(`/inbounds/${code}/approve`); message.success('已审批'); load() }
  const putaway = async () => { await api.post(`/inbounds/${code}/putaway`); message.success('已上架过账'); load() }
  const cancel = async () => { await api.post(`/inbounds/${code}/cancel`); message.success('已取消'); load() }

  const addItem = (v:any) => setEditItems(prev=> [...prev, { ...v, expDate: v.expDate?.format?.('YYYY-MM-DD') }])
  const removeItem = (idx:number) => setEditItems(prev=> prev.filter((_v,_i)=> _i!==idx))
  const fetchBatchOptions = async (materialCode?: string, setFn?: (opts: Array<{ value: string }>)=>void) => {
    const mc = (materialCode||'').trim(); if (!mc) { setFn?.([]); return }
    const wh = 'WH1'
    try {
      const { data } = await api.get('/stocks', { params: { materialCode: mc, warehouse: wh } })
      const rows = Array.isArray(data)? data: []
      rows.sort((a:any,b:any)=>{
        const ax = a.expDate? new Date(a.expDate).getTime(): Number.MAX_SAFE_INTEGER
        const bx = b.expDate? new Date(b.expDate).getTime(): Number.MAX_SAFE_INTEGER
        return ax - bx
      })
      const opts = rows
        .filter((r:any)=> Number((r.qtyAvailable ?? (Number(r.qtyOnHand)-Number(r.qtyAllocated)))) > 0)
        .map((r:any)=> ({ value: r.batchNo || '' }))
      setFn?.(opts)
    } catch { setFn?.([]) }
  }
  const fefoHint = useMemo(()=> (addBatchOpts[0]?.value? `批次建议（按FEFO）：${addBatchOpts[0].value}`: ''), [addBatchOpts])
  const saveDraft = async ()=> {
    try {
      const v = await form.validateFields()
  if (!editItems.length) return message.warning('请先添加至少一行明细')
  if (hasErrors) return message.error('明细存在校验错误，请先修正后再保存草稿')
      await api.put(`/inbounds/${code}`, { supplier: v.supplier, arriveDate: v.arriveDate?.format('YYYY-MM-DD'), items: editItems })
      message.success('草稿已保存')
      load()
    } catch(e:any) { message.error(e?.response?.data?.message || e?.message || '保存失败') }
  }

  if (!data) return null
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
  <Card className="glass-card" title={`入库单 ${code}`} extra={<Tag color={data.status==='DRAFT'?'default':data.status==='APPROVED'?'blue':data.status==='PUTAWAY'?'green':'red'}>{data.status}</Tag>}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="来源">{data.sourceType}</Descriptions.Item>
          <Descriptions.Item label="供应商">{data.supplier||'-'}</Descriptions.Item>
          <Descriptions.Item span={2} label="到货日期">{data.arriveDate||'-'}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>
          {data.status==='DRAFT' && <Button onClick={approve}>审批</Button>}
          {data.status==='APPROVED' && <Button type="primary" onClick={putaway} style={{ marginLeft: 8 }}>上架过账</Button>}
          {(data.status==='DRAFT' || data.status==='APPROVED') && <Button danger onClick={cancel} style={{ marginLeft: 8 }}>取消</Button>}
        </div>
      </Card>
  {data.status==='DRAFT' ? (
      <Card className="glass-card" title="草稿编辑">
        <Form layout="inline" form={form} onFinish={addItem}>
          <Form.Item name="supplier" label="供应商"><Input style={{minWidth:220}} /></Form.Item>
          <Form.Item name="arriveDate" label="到货日期"><DatePicker /></Form.Item>
        </Form>
        <Form layout="inline" onFinish={addItem} style={{marginTop:12}}>
          <Form.Item name="materialCode" rules={[{required:true}]}>
            <Input placeholder="物料编码" onBlur={(e)=> fetchBatchOptions(e.target.value, setAddBatchOpts)} />
          </Form.Item>
          <Form.Item name="qty" rules={[{required:true}]}><InputNumber placeholder="数量" min={0} /></Form.Item>
          <Form.Item name="batchNo">
            <AutoComplete placeholder="批次（可直接输入或选择建议）" options={addBatchOpts}
              onFocus={()=> fetchBatchOptions(form.getFieldValue('materialCode'), setAddBatchOpts)}
            />
          </Form.Item>
          <Form.Item name="expDate"><DatePicker placeholder="到期日期" /></Form.Item>
          <Form.Item><Button htmlType="submit">添加</Button></Form.Item>
          <Form.Item><Button onClick={saveDraft} type="primary">保存草稿</Button></Form.Item>
          {fefoHint && <Typography.Text type="secondary" style={{ marginLeft: 8 }}>{fefoHint}</Typography.Text>}
        </Form>
        <Table rowKey={(record:any, index?: number)=> String(index ?? record?.id ?? Math.random())} dataSource={editItems} pagination={false} style={{marginTop:12}}
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
            { title:'批次', dataIndex:'batchNo', render: (_v:any,_r:any,i:number)=> (
              <AutoComplete
                value={editItems[i]?.batchNo}
                options={rowBatchOpts[i] || []}
                onFocus={()=> fetchBatchOptions(editItems[i]?.materialCode, (opts)=> setRowBatchOpts(prev=> ({ ...prev, [i]: opts })))}
                onChange={(val)=> setEditItems(prev=> prev.map((it,j)=> j===i? { ...it, batchNo: val as any }: it))}
                placeholder="批次（可直接输入或选择建议）"
                style={{ minWidth: 200 }}
              />
            ) },
            { title:'到期', dataIndex:'expDate', render: (_v:any,_r:any,i:number)=> (
              <div>
                <DatePicker status={rowErrors[i]?.expDate?'error':undefined} value={editItems[i]?.expDate ? dayjs(editItems[i]?.expDate) : undefined} onChange={(d)=> setEditItems(prev=> prev.map((it,j)=> j===i? { ...it, expDate: d?.format('YYYY-MM-DD') }: it))} />
                {rowErrors[i]?.expDate && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[i].expDate}</div>}
              </div>
            ) },
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
            { title:'批次', dataIndex:'batchNo' },
            { title:'到期', dataIndex:'expDate' },
          ]}
        />
      </Card>
    )}
    </Space>
  )
}
