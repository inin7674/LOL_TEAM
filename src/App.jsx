import { useMemo, useState } from 'react'
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import './App.css'

const TEAM = {
  POOL: 'pool',
  A: 'teamA',
  B: 'teamB',
}

function parsePlayers(text) {
  if (!text) return []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const parts = line.split('/').map((p) => p.trim()).filter(Boolean)
    const name = parts[0] ?? ''
    const positionsText = parts.slice(1).join(' ')
    const positions = positionsText
      ? positionsText.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean)
      : []

    return {
      id: crypto.randomUUID(),
      name,
      positions,
      team: TEAM.POOL,
    }
  }).filter((p) => p.name)
}

function DraggablePlayer({ player, onAssign, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.6 : 1,
      }
    : undefined

  return (
    <div ref={setNodeRef} style={style} className="player-card" {...attributes} {...listeners}>
      <div className="player-main">
        <div className="player-name">{player.name}</div>
        {player.positions.length > 0 && (
          <div className="player-positions">
            {player.positions.map((pos) => (
              <span key={pos} className="pill">{pos}</span>
            ))}
          </div>
        )}
      </div>
      <div className="player-actions">
        <button onClick={() => onAssign(player.id, TEAM.A)}>A</button>
        <button onClick={() => onAssign(player.id, TEAM.B)}>B</button>
        <button onClick={() => onAssign(player.id, TEAM.POOL)}>대기</button>
        <button className="danger" onClick={() => onRemove(player.id)}>삭제</button>
      </div>
    </div>
  )
}

function DropColumn({ id, title, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className={`column ${isOver ? 'over' : ''}`}>
      <div className="column-title">{title}</div>
      <div className="column-body">{children}</div>
    </div>
  )
}

function App() {
  const [players, setPlayers] = useState([])
  const [input, setInput] = useState('')

  const grouped = useMemo(() => {
    return {
      [TEAM.POOL]: players.filter((p) => p.team === TEAM.POOL),
      [TEAM.A]: players.filter((p) => p.team === TEAM.A),
      [TEAM.B]: players.filter((p) => p.team === TEAM.B),
    }
  }, [players])

  const addFromText = (text) => {
    const parsed = parsePlayers(text)
    if (parsed.length === 0) return
    setPlayers((prev) => [...prev, ...parsed])
  }

  const handlePaste = (event) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text')
    addFromText(text)
  }

  const handleAddClick = () => {
    addFromText(input)
    setInput('')
  }

  const assignPlayer = (id, team) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, team } : p)))
  }

  const removePlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id))
  }

  const clearAll = () => setPlayers([])

  const onDragEnd = ({ active, over }) => {
    if (!over) return
    const target = over.id
    if (![TEAM.POOL, TEAM.A, TEAM.B].includes(target)) return
    assignPlayer(active.id, target)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>LoL 내전 팀 나누기</h1>
        <p>디스코드에서 복사한 텍스트를 붙여넣으면 자동으로 추가됩니다.</p>
      </header>

      <section className="input-section">
        <textarea
          placeholder="예) 덴펄이#덴푸르푸르 / 골 / 정글 탑"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          rows={3}
        />
        <div className="input-actions">
          <button onClick={handleAddClick}>입력 내용 추가</button>
          <button className="ghost" onClick={clearAll}>전체 초기화</button>
        </div>
      </section>

      <DndContext onDragEnd={onDragEnd}>
        <div className="columns">
          <DropColumn id={TEAM.POOL} title={`대기 (${grouped[TEAM.POOL].length})`}>
            {grouped[TEAM.POOL].map((player) => (
              <DraggablePlayer
                key={player.id}
                player={player}
                onAssign={assignPlayer}
                onRemove={removePlayer}
              />
            ))}
          </DropColumn>
          <DropColumn id={TEAM.A} title={`팀 A (${grouped[TEAM.A].length})`}>
            {grouped[TEAM.A].map((player) => (
              <DraggablePlayer
                key={player.id}
                player={player}
                onAssign={assignPlayer}
                onRemove={removePlayer}
              />
            ))}
          </DropColumn>
          <DropColumn id={TEAM.B} title={`팀 B (${grouped[TEAM.B].length})`}>
            {grouped[TEAM.B].map((player) => (
              <DraggablePlayer
                key={player.id}
                player={player}
                onAssign={assignPlayer}
                onRemove={removePlayer}
              />
            ))}
          </DropColumn>
        </div>
      </DndContext>
    </div>
  )
}

export default App
