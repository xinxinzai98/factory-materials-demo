import React from 'react'
import { Button, Form, Input, InputNumber, message, Space, Select, AutoComplete, Typography } from 'antd'
import { api } from '@/api/http'

export default function TransferPage() {
  const [form] = Form.useForm()
  const [warehouses, setWarehouses] = React.useState<Array<{ value: string; label: string }>>([{ value: 'WH1', label: '主仓' }])
  const [locations, setLocations] = React.useState<Array<{ value: string; label: string }>>([])
  const [batchOpts, setBatchOpts] = React.useState<Array<{ value: string }>>([])

  React.useEffect(()=>{
    api.get('/warehouses').then(({ data })=>{
      setWarehouses((data||[]).map((w:any)=> ({ value: w.code, label: `${w.code} - ${w.name||w.code}` })))
    }).catch(()=>{})
  },[])

  const loadLocations = async (warehouseCode?: string) => {
    const wc = (warehouseCode||'').trim(); if (!wc) { setLocations([]); return }
    try {
      const { data } = await api.get('/locations', { params: { warehouse: wc, enabled: true } })
      setLocations((data||[]).map((l:any)=> ({ value: l.code, label: `${l.code}${l.zone? ' - '+l.zone: ''}` })))
    } catch { setLocations([]) }
  }

  const fetchBatchOptions = async (materialCode?: string, warehouseCode?: string) => {
    const mc = (materialCode || '').trim(); if (!mc) { setBatchOpts([]); return }
    const wc = (warehouseCode || form.getFieldValue('fromWarehouse') || 'WH1').trim()
    try {
      const { data } = await api.get('/stocks', { params: { materialCode: mc, warehouse: wc } })
      const rows = Array.isArray(data)? data: []
      rows.sort((a:any,b:any)=>{
        const ax = a.expDate? new Date(a.expDate).getTime(): Number.MAX_SAFE_INTEGER
        const bx = b.expDate? new Date(b.expDate).getTime(): Number.MAX_SAFE_INTEGER
        return ax - bx
      })
      const opts = rows.filter((r:any)=> Number((r.qtyAvailable ?? (Number(r.qtyOnHand)-Number(r.qtyAllocated)))) > 0)
        .map((r:any)=> ({ value: r.batchNo || '' }))
      setBatchOpts(opts)
    } catch { setBatchOpts([]) }
  }

  const fefoHint = React.useMemo(()=> batchOpts?.[0]?.value ? `批次建议（FEFO）：${batchOpts[0].value}` : '', [batchOpts])

  const onFinish = async (v: any) => {
    try {
      await api.post('/transfers', v)
      message.success('移库成功')
      form.resetFields()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '移库失败')
    }
  }
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ qty: 1 }} onValuesChange={(chg, all)=>{
        if ('fromWarehouse' in chg) loadLocations(all.fromWarehouse)
        if ('materialCode' in chg) fetchBatchOptions(all.materialCode, all.fromWarehouse)
      }}>
        <Space.Compact block>
          <Form.Item name="materialCode" label="物料编码" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="如 M001" onBlur={(e)=> fetchBatchOptions(e.target.value, form.getFieldValue('fromWarehouse'))} />
          </Form.Item>
          <Form.Item name="qty" label="数量" rules={[{ required: true }]}>
            <InputNumber min={0.0001} step={1} style={{ width: 160 }} />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="fromWarehouse" label="来源仓库" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select placeholder="选择来源仓库" options={warehouses} showSearch />
          </Form.Item>
          <Form.Item name="fromBatchNo" label="来源批次(可选)" style={{ flex: 1 }}>
            <AutoComplete placeholder="选择或输入批次" options={batchOpts} onFocus={()=> fetchBatchOptions(form.getFieldValue('materialCode'), form.getFieldValue('fromWarehouse'))} />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="toWarehouse" label="目标仓库" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select placeholder="选择目标仓库" options={warehouses} showSearch />
          </Form.Item>
          <Form.Item name="toLocation" label="目标库位(可选)" style={{ flex: 1 }}>
            <Select placeholder="选择目标库位(可选)" options={locations} allowClear showSearch onDropdownVisibleChange={(open)=>{ if (open) loadLocations(form.getFieldValue('toWarehouse')) }} />
          </Form.Item>
        </Space.Compact>
        <Button type="primary" htmlType="submit">提交移库</Button>
      </Form>
      {fefoHint && <Typography.Text type="secondary">{fefoHint}</Typography.Text>}
    </Space>
  )
}
