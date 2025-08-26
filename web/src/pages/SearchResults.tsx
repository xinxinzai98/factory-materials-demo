import { useEffect, useState } from 'react'
import { Input, List, Card, Tabs, Tag } from 'antd'
import { useLocation, Link } from 'react-router-dom'
import { api } from '@/api/http'

export default function SearchResults() {
  const loc = useLocation()
  const [q, setQ] = useState<string>('')
  const [data, setData] = useState<any>({ materials: [], orders: [], batches: [] })
  const doSearch = async (kw: string) => {
    if (!kw) { setData({ materials: [], orders: [], batches: [] }); return }
    const { data } = await api.get('/search', { params: { q: kw } })
    setData(data || { materials: [], orders: [], batches: [] })
  }
  useEffect(()=>{
    const usp = new URLSearchParams(loc.search)
    const kw = usp.get('q') || ''
    setQ(kw)
    doSearch(kw)
  }, [loc.search])

  return (
    <div>
      <Input.Search value={q} onChange={e=> setQ(e.target.value)} onSearch={doSearch} placeholder="搜索物料/单号/批次" allowClear />
      <Tabs style={{ marginTop: 12 }} items={[
        { key: 'materials', label: `物料 (${data.materials.length})`, children:
          <Card>
            <List dataSource={data.materials} renderItem={(m:any)=> (
              <List.Item>
                <List.Item.Meta title={<Link to={`/materials?code=${encodeURIComponent(m.code)}`}>{m.code} {m.name}</Link>} description={m.spec || ''} />
                <Tag>{m.uom}</Tag>
              </List.Item>
            )} />
          </Card>
        },
        { key: 'orders', label: `单据 (${data.orders.length})`, children:
          <Card>
            <List dataSource={data.orders} renderItem={(o:any)=> (
              <List.Item>
                <Link to={o.type==='INBOUND'?`/inbounds/${o.code}`:`/outbounds/${o.code}`}>{o.type} {o.code}</Link>
              </List.Item>
            )} />
          </Card>
        },
        { key: 'batches', label: `批次 (${data.batches.length})`, children:
          <Card>
            <List dataSource={data.batches} renderItem={(b:any)=> (
              <List.Item>
                <List.Item.Meta title={`批次 ${b.batchNo}`} description={`物料 ${b.materialCode} 到期 ${String(b.expDate||'').slice(0,10)}`} />
                <Link to={`/stocks?material=${encodeURIComponent(b.materialCode)}&batch=${encodeURIComponent(b.batchNo)}`}>查看库存</Link>
              </List.Item>
            )} />
          </Card>
        },
      ]} />
    </div>
  )
}
