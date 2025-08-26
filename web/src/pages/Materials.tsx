import { useEffect, useState } from 'react'
import { Button, Form, Input, Space, Table, message, Flex, Modal, Upload } from 'antd'
import type { UploadProps } from 'antd'
import { api } from '@/api/http'

type Material = {
  id: string
  code: string
  name: string
  uom: string
  spec?: string
  category?: string
  barcode?: string
  isBatch: boolean
  shelfLifeDays?: number
  enabled: boolean
}

export default function MaterialsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Material[]>([])

  const [form] = Form.useForm()
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const uploadProps: UploadProps = {
    accept: '.csv,text/csv,text/plain',
    beforeUpload: async (file) => {
      const text = await file.text()
      setCsvText(text)
      message.success(`已读取文件：${file.name}`)
      return false
    }
  }

  const fetchData = async (q?: string) => {
    setLoading(true)
    try {
      const resp = await api.get('/materials', { params: { q, page: 1, pageSize: 50 } })
      setData(resp.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const onCreate = async (values: any) => {
    await api.post('/materials', values)
    message.success('已创建')
    form.resetFields()
    fetchData()
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Flex gap={8}>
        <Form layout="inline" onFinish={({ q }) => fetchData(q)}>
          <Form.Item name="q"><Input placeholder="搜索 物料编码/名称" allowClear /></Form.Item>
          <Form.Item><Button htmlType="submit" type="primary">查询</Button></Form.Item>
        </Form>
      </Flex>

      <Form form={form} layout="inline" onFinish={onCreate}>
        <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="物料编码" /></Form.Item>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="物料名称" /></Form.Item>
        <Form.Item name="uom" initialValue="PCS" rules={[{ required: true }]}><Input placeholder="单位" /></Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">新增物料</Button>
            <Button onClick={()=> window.open('/api/materials/template.csv','_blank')}>下载模板</Button>
            <Button onClick={()=> setImportOpen(true)}>导入 CSV</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table rowKey="id" loading={loading} dataSource={data} pagination={false}
        columns={[
          { title: '编码', dataIndex: 'code' },
          { title: '名称', dataIndex: 'name' },
          { title: '单位', dataIndex: 'uom' },
          { title: '分类', dataIndex: 'category' },
          { title: '是否批次', dataIndex: 'isBatch', render: (v:boolean)=> v? '是':'否' },
        ]}
      />

  <Modal title="导入物料 CSV" open={importOpen} onCancel={()=> setImportOpen(false)} onOk={async()=>{
        try {
          const text = csvText.trim()
          if (!text) return message.warning('请粘贴或选择 CSV 文件')
          const lines = text.split(/\r?\n/).filter(l=> l.trim().length>0)
          if (lines.length<=1) return message.warning('没有数据行')
          const header = lines[0].split(',').map(s=> s.trim())
          const need = ['code','name','uom']
          for (const k of need) if (!header.includes(k)) return message.error('缺少必需表头: ' + k)
          const iCode = header.indexOf('code'); const iName = header.indexOf('name'); const iUom = header.indexOf('uom')
          const iIsBatch = header.indexOf('isBatch'); const iSL = header.indexOf('shelfLifeDays')
          const errors: string[] = []
          for (let r=1; r<lines.length; r++) {
            const cols = lines[r].split(',')
            const code = (cols[iCode]||'').trim(); const name = (cols[iName]||'').trim(); const uom = (cols[iUom]||'').trim()
            if (!code || !name || !uom) errors.push(`第${r+1}行: code/name/uom 不能为空`)
            if (iIsBatch>=0) {
              const v = (cols[iIsBatch]||'').trim().toLowerCase()
              if (v && !['true','false'].includes(v)) errors.push(`第${r+1}行: isBatch 需为 true/false`)
            }
            if (iSL>=0) {
              const n = Number((cols[iSL]||'').trim()||'')
              if (cols[iSL] && (!isFinite(n) || n<0)) errors.push(`第${r+1}行: shelfLifeDays 需为非负整数`)
            }
          }
          if (errors.length) {
            Modal.error({ title: '导入校验失败', content: <div style={{maxHeight:240, overflow:'auto'}}>{errors.map((e,i)=> <div key={i}>{e}</div>)}</div> })
            return
          }
          const resp = await api.post('/materials/import-csv', { csv: text })
          const r = resp.data || {}
          Modal.success({
            title: '导入完成',
            content: (
              <div style={{ maxHeight: 260, overflow: 'auto' }}>
                <div>总行数：{r.total ?? (lines.length-1)}</div>
                <div>创建成功：{r.createdCount ?? (r.created?.length||0)}</div>
                {Array.isArray(r.created)&&r.created.length>0 && <div style={{marginTop:4}}>新建编码：{r.created.join(', ')}</div>}
                <div style={{marginTop:6}}>跳过：{r.skippedCount ?? (r.skipped?.length||0)}</div>
                {Array.isArray(r.skipped)&&r.skipped.length>0 && <div style={{marginTop:4}}>跳过编码（重复/缺少字段）：{r.skipped.join(', ')}</div>}
              </div>
            )
          })
          setImportOpen(false)
          setCsvText('')
          fetchData()
        } catch(e:any) {
          message.error(e?.response?.data?.message || e?.message || '导入失败')
        }
      }}>
        <p>请粘贴完整 CSV 文本或选择 CSV 文件（需包含表头：code,name,uom,isBatch,shelfLifeDays）</p>
        <Upload {...uploadProps}>
          <Button style={{ marginBottom: 8 }}>选择 CSV 文件</Button>
        </Upload>
        <Input.TextArea rows={8} value={csvText} onChange={(e)=> setCsvText(e.target.value)} placeholder="粘贴 CSV 文本..." />
      </Modal>
    </Space>
  )
}
