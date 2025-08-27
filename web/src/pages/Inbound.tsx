import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Space, Table, message, DatePicker, Select, Popconfirm, AutoComplete, Typography } from 'antd'
import dayjs from 'dayjs'
import { api } from '@/api/http'

type Item = { materialCode: string; qty: number; batchNo?: string; expDate?: string; uprice?: number }

export default function InboundPage() {
  const [form] = Form.useForm()
  const [items, setItems] = useState<Item[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<{ value: string; label: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([{ value: 'WH1', label: '主仓' }])
  const [addBatchOpts, setAddBatchOpts] = useState<Array<{ value: string }>>([])
  const [rowBatchOpts, setRowBatchOpts] = useState<Record<number, Array<{ value: string }>>>({})
  const rowErrors = React.useMemo(()=>{
    const errs: Record<number, Record<string, string>> = {}
    const today = dayjs().startOf('day')
    items.forEach((it, idx)=>{
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
  }, [items])
  const hasErrors = Object.keys(rowErrors).length>0

  useEffect(() => {
    // 加载供应商列表
    api.get('/suppliers', { params: { enabled: true } }).then(({ data }) => {
      const opts = (data || []).map((s: any) => ({ value: s.name, label: `${s.code} - ${s.name}` }))
      setSuppliers(opts)
    }).catch(() => {})
    // 加载仓库列表
    api.get('/warehouses').then(({ data })=>{
      const opts = (data || []).map((w:any)=> ({ value: w.code, label: `${w.code} - ${w.name||w.code}` }))
      setWarehouses(opts)
    }).catch(()=>{})
  }, [])

  const addItem = (it: Item) => {
    setItems((prev: Item[]) => [...prev, it])
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_v, i) => i !== idx))

  // 批次建议：按物料+仓库查询已有批次（可用>0），便于沿用旧批次；按到期日升序（FEFO）
  const fetchBatchOptions = async (materialCode?: string, setFn?: (opts: Array<{ value: string }>)=>void) => {
    const mc = (materialCode||'').trim(); if (!mc) { setFn?.([]); return }
    const wh = form.getFieldValue('warehouseCode') || 'WH1'
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

  const saveDraft = async () => {
    try {
      const v = await form.validateFields(['code','supplier','arriveDate','warehouseCode'])
      if (!items.length) return message.warning('请先添加至少一行明细')
  if (hasErrors) return message.error('明细存在校验错误，请先修正后再保存草稿')
      const payload = {
        code: v.code,
        sourceType: 'PURCHASE',
        supplier: v.supplier,
        arriveDate: v.arriveDate?.format('YYYY-MM-DD'),
        items: items.map(i=>({ ...i, expDate: i.expDate }))
      }
      await api.post('/inbounds/draft', payload)
      message.success('已保存草稿')
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '保存失败')
    }
  }

  const submit = async () => {
    try {
      setSubmitting(true)
      const v = await form.validateFields()
  if (!items.length) return message.warning('请先添加至少一行明细')
  if (hasErrors) return message.error('明细存在校验错误，请先修正后再过账')
      const payload = { code: v.code, sourceType: 'PURCHASE', supplier: v.supplier, arriveDate: v.arriveDate?.format('YYYY-MM-DD'), warehouseCode: v.warehouseCode || 'WH1', items: items.map(i=>({ ...i, expDate: i.expDate })) }
      const resp = await api.post('/inbounds', payload)
      if (resp.status >= 200 && resp.status < 300) {
        message.success('入库成功')
        setItems([])
        form.resetFields()
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '入库失败'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card className="glass-card" title="入库单">
        <Form form={form} layout="inline">
          <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="入库单号" /></Form.Item>
          <Form.Item name="supplier"><Select placeholder="供应商" style={{ minWidth: 220 }} options={suppliers} allowClear showSearch /></Form.Item>
          <Form.Item name="arriveDate"><DatePicker placeholder="到货日期" /></Form.Item>
          <Form.Item name="warehouseCode" initialValue="WH1"><Select placeholder="仓库名称" style={{ minWidth: 140 }} options={warehouses} /></Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={saveDraft} disabled={items.length===0}>保存草稿</Button>
              <Button type="primary" onClick={submit} loading={submitting} disabled={items.length===0}>直接过账</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card className="glass-card" title="新增入库明细">
        <Form layout="inline" onFinish={(v)=> addItem({ ...v, expDate: v.expDate?.format?.('YYYY-MM-DD') })}>
          <Form.Item name="materialCode" rules={[{ required: true, message: '物料必填' }]}>
            <Input placeholder="物料编码" onBlur={(e)=> fetchBatchOptions(e.target.value, setAddBatchOpts)} />
          </Form.Item>
          <Form.Item name="qty" rules={[{ required: true, message: '数量必填' }, { validator: (_,_v)=> {
            const n = Number(_v); if (!isFinite(n) || n<=0) return Promise.reject(new Error('数量必须>0'));
            return Promise.resolve();
          }}]}>
            <InputNumber placeholder="数量" min={0.0001} />
          </Form.Item>
          <Form.Item name="batchNo">
            <AutoComplete placeholder="批次（可直接输入或选择建议）" options={addBatchOpts}
              onFocus={()=> fetchBatchOptions(form.getFieldValue('materialCode'), setAddBatchOpts)}
            />
          </Form.Item>
          <Form.Item name="expDate" rules={[{ validator: (_,_v)=> {
            if (!_v) return Promise.resolve();
            const today = dayjs().startOf('day');
            const d = dayjs(_v).startOf('day');
            if (d.isBefore(today)) return Promise.reject(new Error('到期日不能早于今天'));
            return Promise.resolve();
          }}]}>
            <DatePicker placeholder="到期日期" />
          </Form.Item>
          <Form.Item><Button htmlType="submit">添加</Button></Form.Item>
          {fefoHint && <Typography.Text type="secondary" style={{ marginLeft: 8 }}>{fefoHint}</Typography.Text>}
        </Form>
      </Card>

  <Table rowKey={(_r, i)=> String(i)} dataSource={items} pagination={false}
        columns={[
          { title: '物料', dataIndex: 'materialCode', render: (_v:any, _r:any, idx:number) => (
            <div>
              <Input status={rowErrors[idx]?.materialCode?'error':undefined} value={items[idx]?.materialCode} onChange={(e)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, materialCode: e.target.value }: it))} />
              {rowErrors[idx]?.materialCode && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[idx].materialCode}</div>}
            </div>
          ) },
          { title: '数量', dataIndex: 'qty', render: (_v:any, _r:any, idx:number) => (
            <div>
              <InputNumber status={rowErrors[idx]?.qty?'error':undefined} min={0.0001} value={items[idx]?.qty} onChange={(val)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, qty: Number(val||0) }: it))} />
              {rowErrors[idx]?.qty && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[idx].qty}</div>}
            </div>
          ) },
          { title: '批次', dataIndex: 'batchNo', render: (_v:any, _r:any, idx:number) => (
            <AutoComplete
              value={items[idx]?.batchNo}
              options={rowBatchOpts[idx] || []}
              onFocus={()=> fetchBatchOptions(items[idx]?.materialCode, (opts)=> setRowBatchOpts(prev=> ({ ...prev, [idx]: opts })))}
              onChange={(val)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, batchNo: val as any }: it))}
              placeholder="批次（可直接输入或选择建议）"
              style={{ minWidth: 200 }}
            />
          ) },
          { title: '到期', dataIndex: 'expDate', render: (_v:any, _r:any, idx:number) => (
            <div>
              <DatePicker status={rowErrors[idx]?.expDate?'error':undefined} value={items[idx]?.expDate ? dayjs(items[idx]?.expDate) : undefined} onChange={(d)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, expDate: d?.format('YYYY-MM-DD') }: it))} />
              {rowErrors[idx]?.expDate && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[idx].expDate}</div>}
            </div>
          ) },
          { title: '操作', render: (_: any, _r: any, i: number) => (
            <Popconfirm title="移除此行?" onConfirm={()=> removeItem(i)}>
              <a>删除</a>
            </Popconfirm>
          ) },
        ]}
      />
    </Space>
  )
}
