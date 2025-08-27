import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Radio, Space, Table, message, Select, Popconfirm, Tooltip, Typography } from 'antd'
import { api, cachedGet } from '@/api/http'

type Item = { materialCode: string; qty: number; batchPolicy?: 'SYSTEM' | 'SPECIFIED'; batchNo?: string }

export default function OutboundPage() {
  const [form] = Form.useForm()
  const [addForm] = Form.useForm()
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([{ value: 'WH1', label: '主仓' }])
  const [batchOpts, setBatchOpts] = useState<Array<{ value: string; label: string }>>([])
  const rowErrors = React.useMemo(()=>{
    const errs: Record<number, Record<string, string>> = {}
    items.forEach((it, idx)=>{
      const e: Record<string, string> = {}
      if (!it.materialCode?.trim()) e.materialCode = '物料必填'
      if (!(Number(it.qty)>0)) e.qty = '数量必须>0'
      if ((it.batchPolicy||'SYSTEM')==='SPECIFIED' && !it.batchNo?.trim()) e.batchNo = '指定批次时必须填写批次'
      if (Object.keys(e).length) errs[idx] = e
    })
    return errs
  }, [items])
  const hasErrors = Object.keys(rowErrors).length>0

  const addItem = (it: Item) => setItems((prev: Item[]) => [...prev, it])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_v, i) => i !== idx))

  // 查询批次建议（按物料+仓库，可用>0，按到期升序-FEFO）
  const fetchBatchOptions = async (materialCode?: string, warehouseCode?: string) => {
    const mc = (materialCode || '').trim()
    const wh = (warehouseCode || '').trim() || 'WH1'
    if (!mc) { setBatchOpts([]); return }
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
      setBatchOpts(opts)
    } catch { setBatchOpts([]) }
  }

  const fefoHint = useMemo(()=> batchOpts?.[0]?.label ? `FEFO建议优先：${batchOpts[0].label}` : '', [batchOpts])

  const submit = async () => {
    const v = await form.validateFields()
    if (!items.length) return message.warning('请先添加至少一行明细')
    if (hasErrors) return message.error('明细存在校验错误，请先修正后再过账')
    const payload = { code: v.code, purpose: 'MO_ISSUE', warehouseCode: v.warehouseCode || 'WH1', items }
    await api.post('/outbounds', payload)
    message.success('出库成功')
    setItems([])
    form.resetFields()
  }

  const saveDraft = async () => {
    try {
      const v = await form.validateFields(['code','warehouseCode'])
      if (!items.length) return message.warning('请先添加至少一行明细')
      const payload = { code: v.code, purpose: 'MO_ISSUE', items }
      await api.post('/outbounds/draft', payload)
      message.success('已保存草稿')
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '保存失败')
    }
  }

  useEffect(()=>{
    cachedGet('/warehouses').then((data:any)=>{
      const opts = ((data as any) || []).map((w:any)=> ({ value: w.code, label: `${w.code} - ${w.name||w.code}` }))
      setWarehouses(opts)
    }).catch(()=>{})
  },[])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
    <Card className="glass-card" title="出库单">
        <Form form={form} layout="inline">
          <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="出库单号" /></Form.Item>
  <Form.Item name="warehouseCode" initialValue="WH1"><Select placeholder="仓库名称" style={{ minWidth: 140 }} options={warehouses} showSearch /></Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={saveDraft} disabled={items.length===0 || hasErrors}>保存草稿</Button>
              <Button type="primary" onClick={submit}>直接过账</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

    <Card className="glass-card" title="新增出库明细">
  <Form layout="inline" form={addForm} onFinish={addItem} initialValues={{ batchPolicy: 'SYSTEM' }} onValuesChange={(chg, all)=>{
            if ('materialCode' in chg) {
              const wh = form.getFieldValue('warehouseCode') || 'WH1'
              fetchBatchOptions(all.materialCode, wh)
            }
          }}>
          <Form.Item name="materialCode" rules={[{ required: true, message: '物料必填' }]}><Input placeholder="物料编码" onBlur={()=>{
            const wh = form.getFieldValue('warehouseCode') || 'WH1'
            const mc = addForm.getFieldValue('materialCode')
            fetchBatchOptions(mc, wh)
          }} /></Form.Item>
          <Form.Item name="qty" rules={[{ required: true, message: '数量必填' }, { validator: (_,_v)=> {
            const n = Number(_v); if (!isFinite(n) || n<=0) return Promise.reject(new Error('数量必须>0'));
            return Promise.resolve();
          }}]}>
            <InputNumber placeholder="数量" min={0.0001} />
          </Form.Item>
          <Form.Item name="batchPolicy"><Radio.Group options={[{label:'系统策略',value:'SYSTEM'},{label:'指定批次',value:'SPECIFIED'}]} /></Form.Item>
          <Form.Item noStyle shouldUpdate={(prev,cur)=> prev.batchPolicy !== cur.batchPolicy || prev.materialCode !== cur.materialCode}>
            {({ getFieldValue }) => (
              getFieldValue('batchPolicy')==='SPECIFIED' ? (
                <Form.Item name="batchNo" rules={[{ required: true, message: '指定批次策略时必须填写批次' }]}>
                  <Select
                    showSearch
                    placeholder="选择批次（基于可用库存）"
                    options={batchOpts}
                    onDropdownVisibleChange={(open)=>{ if (open) {
                      const wh = form.getFieldValue('warehouseCode') || 'WH1'
                      const mc = addForm.getFieldValue('materialCode')
                      fetchBatchOptions(mc, wh)
                    }}}
                    style={{ minWidth: 280 }}
                  />
                </Form.Item>
              ) : (
                <Form.Item name="batchNo">
                  <Input placeholder={'系统策略下由系统自动选择批次'} disabled />
                </Form.Item>
              )
            )}
          </Form.Item>
          <Form.Item><Button htmlType="submit">添加</Button></Form.Item>
          {fefoHint && <Typography.Text type="secondary" style={{ marginLeft: 8 }}>{fefoHint}</Typography.Text>}
        </Form>
      </Card>

  <Table rowKey={(_r, i)=> String(i)} dataSource={items} pagination={false}
        columns={[
          { title: '物料', dataIndex: 'materialCode', render: (_v:any,_r:any,idx:number)=> (
            <div>
              <Input status={rowErrors[idx]?.materialCode?'error':undefined} value={items[idx]?.materialCode} onChange={(e)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, materialCode: e.target.value }: it))} />
              {rowErrors[idx]?.materialCode && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[idx].materialCode}</div>}
            </div>
          ) },
          { title: '数量', dataIndex: 'qty', render: (_v:any,_r:any,idx:number)=> (
            <div>
              <InputNumber status={rowErrors[idx]?.qty?'error':undefined} min={0.0001} value={items[idx]?.qty} onChange={(val)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, qty: Number(val||0) }: it))} />
              {rowErrors[idx]?.qty && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[idx].qty}</div>}
            </div>
          ) },
          { title: '策略', dataIndex: 'batchPolicy', render: (_v:any,_r:any,idx:number)=> (
            <Radio.Group value={items[idx]?.batchPolicy || 'SYSTEM'} onChange={(e)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, batchPolicy: e.target.value }: it))}
              options={[{label:'系统策略',value:'SYSTEM'},{label:'指定批次',value:'SPECIFIED'}]} />
          ) },
          { title: '批次', dataIndex: 'batchNo', render: (_v:any,_r:any,idx:number)=> {
            const isSystem = (items[idx]?.batchPolicy || 'SYSTEM') === 'SYSTEM'
            const input = (
              <Input
                status={rowErrors[idx]?.batchNo?'error':undefined}
                value={items[idx]?.batchNo}
                onChange={(e)=> setItems(prev=> prev.map((it,j)=> j===idx? { ...it, batchNo: e.target.value }: it))}
                disabled={isSystem}
                placeholder={isSystem? '系统策略下由系统自动选择批次':''}
              />
            )
            return (
              <div>
                {rowErrors[idx]?.batchNo ? (
                  <Tooltip title={rowErrors[idx].batchNo}>{input}</Tooltip>
                ) : input}
                {rowErrors[idx]?.batchNo && <div style={{ color:'#ff4d4f', fontSize:12 }}>{rowErrors[idx].batchNo}</div>}
              </div>
            )
          } },
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
