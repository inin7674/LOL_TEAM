import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import './App.css'

const TEAM = {
  POOL: 'pool',
  A: 'teamA',
  B: 'teamB',
}

const TIER_ORDER = [
  '챌린저',
  '그랜드마스터',
  '마스터',
  '다이아',
  '에메랄드',
  '플래티넘',
  '골드',
  '실버',
  '브론즈',
  '아이언',
]

const POSITION_PATTERNS = [
  { regex: /(탑|top)/gi, value: '탑' },
  { regex: /(정글|jungle|jg|정)/gi, value: '정글' },
  { regex: /(미드|mid|미)/gi, value: '미드' },
  { regex: /(원딜|adc|bot|바텀|원)/gi, value: '원딜' },
  { regex: /(서폿|서포터|support|sup|폿)/gi, value: '서폿' },
]

const POSITION_TOKEN_MAP = {
  t: '탑',
  top: '탑',
  j: '정글',
  jg: '정글',
  jungle: '정글',
  m: '미드',
  mid: '미드',
  a: '원딜',
  ad: '원딜',
  adc: '원딜',
  bot: '원딜',
  bottom: '원딜',
  s: '서폿',
  sp: '서폿',
  sup: '서폿',
  support: '서폿',
}

const POSITION_INITIAL_CLUSTER = /^[tjmas]{2,5}$/i
const POSITION_ORDER = ['탑', '정글', '미드', '원딜', '서폿']

const TIER_PATTERNS = [
  { regex: /(챌린저|챌|challenger|chall)/i, value: '챌린저' },
  { regex: /(그랜드마스터|그마|grandmaster|gm)/i, value: '그랜드마스터' },
  { regex: /(마스터|마스|master)/i, value: '마스터' },
  { regex: /(다이아|다이|다야|다|diamond|dia)/i, value: '다이아' },
  { regex: /(에메랄드|에메[0-9]?|에|emerald|eme)/i, value: '에메랄드' },
  { regex: /(플래티넘|플레|플|platinum|plat)/i, value: '플래티넘' },
  { regex: /(골드|골|gold)/i, value: '골드' },
  { regex: /(실버|실|silver)/i, value: '실버' },
  { regex: /(브론즈|브론|브|bronze)/i, value: '브론즈' },
  { regex: /(아이언|아|iron)/i, value: '아이언' },
]

const TIER_ALIAS_MAP = {
  c: '챌린저',
  challenger: '챌린저',
  chall: '챌린저',
  첼: '챌린저',
  챌: '챌린저',
  챌린저: '챌린저',
  gm: '그랜드마스터',
  grandmaster: '그랜드마스터',
  그마: '그랜드마스터',
  그랜드마스터: '그랜드마스터',
  m: '마스터',
  master: '마스터',
  마스: '마스터',
  마스터: '마스터',
  dia: '다이아',
  diamond: '다이아',
  다: '다이아',
  다이: '다이아',
  다야: '다이아',
  다이아: '다이아',
  eme: '에메랄드',
  emerald: '에메랄드',
  에: '에메랄드',
  에메: '에메랄드',
  에메랄드: '에메랄드',
  plat: '플래티넘',
  platinum: '플래티넘',
  플: '플래티넘',
  플레: '플래티넘',
  플래티넘: '플래티넘',
  gold: '골드',
  골: '골드',
  골드: '골드',
  silver: '실버',
  실: '실버',
  실버: '실버',
  bronze: '브론즈',
  브: '브론즈',
  브론: '브론즈',
  브론즈: '브론즈',
  i: '아이언',
  iron: '아이언',
  아: '아이언',
  아이언: '아이언',
}

const TIER_INITIAL_MAP = {
  c: '챌린저',
  g: '골드',
  d: '다이아',
  e: '에메랄드',
  p: '플래티넘',
  b: '브론즈',
  i: '아이언',
  m: '마스터',
  s: '실버',
}

function extractPositions(text) {
  const found = []
  let includeAll = false
  const excluded = new Set()
  for (const pattern of POSITION_PATTERNS) {
    const matches = text.match(pattern.regex)
    if (matches) {
      found.push(...new Array(matches.length).fill(pattern.value))
    }
  }

  const tokens = text
    .toLowerCase()
    .split(/[\s/|,._-]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const allMatch = /^(all|allline|올라인|전라인|전부)$/i.test(token)
    if (allMatch) {
      includeAll = true
      continue
    }

    const exceptMatch = token.match(/^(탑|정글|미드|원딜|서폿|top|jungle|jg|mid|adc|bot|support|sup|sp)(빼고다|빼고|제외)$/i)
    if (exceptMatch) {
      includeAll = true
      const pos = POSITION_TOKEN_MAP[exceptMatch[1].toLowerCase()] ?? exceptMatch[1]
      if (POSITION_ORDER.includes(pos)) excluded.add(pos)
      continue
    }

    if (POSITION_TOKEN_MAP[token]) {
      found.push(POSITION_TOKEN_MAP[token])
      continue
    }

    if (POSITION_INITIAL_CLUSTER.test(token)) {
      for (const ch of token) {
        if (POSITION_TOKEN_MAP[ch]) found.push(POSITION_TOKEN_MAP[ch])
      }
    }
  }

  if (includeAll) {
    const allPositions = POSITION_ORDER.filter((pos) => !excluded.has(pos))
    return [...new Set([...allPositions, ...found.filter((pos) => !excluded.has(pos))])]
  }

  return [...new Set(found.filter((pos) => !excluded.has(pos)))]
}

function extractTier(text) {
  const normalized = text.toLowerCase()
  const tokens = normalized
    .split(/[\s/|,._-]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const compact = token.replace(/[0-9]+/g, '')
    if (TIER_ALIAS_MAP[compact]) return TIER_ALIAS_MAP[compact]
  }

  const firstCompact = (tokens[0] ?? '').replace(/[0-9]+/g, '')
  if (firstCompact && TIER_INITIAL_MAP[firstCompact]) {
    // Avoid misreading "M J S" style all-initial position shorthand as tier.
    const isAllSinglePositionInitials = tokens.length >= 2
      && tokens.every((token) => /^[tjmas]$/i.test(token))
    if (isAllSinglePositionInitials) {
      return ''
    }
    return TIER_INITIAL_MAP[firstCompact]
  }

  for (const pattern of TIER_PATTERNS) {
    if (pattern.regex.test(text)) return pattern.value
  }
  return ''
}

function toPlayerKey(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

function getTierClass(tier) {
  const map = {
    챌린저: 'tier-challenger',
    그랜드마스터: 'tier-grandmaster',
    마스터: 'tier-master',
    다이아: 'tier-diamond',
    에메랄드: 'tier-emerald',
    플래티넘: 'tier-platinum',
    골드: 'tier-gold',
    실버: 'tier-silver',
    브론즈: 'tier-bronze',
    아이언: 'tier-iron',
  }
  return map[tier] ?? 'tier-default'
}

function isMetadataLine(line) {
  return /(역할 아이콘|오전|오후|Lv\.)/i.test(line)
}

function isLikelyDetailToken(token) {
  const cleaned = token.toLowerCase().replace(/[0-9]+/g, '').trim()
  if (!cleaned) return false
  if (TIER_ALIAS_MAP[cleaned]) return true
  if (extractPositions(cleaned).length > 0) return true
  return /(올라인|allline)/i.test(cleaned)
}

function parseNameAndDetail(line) {
  const normalized = line.replace(/\s+/g, ' ').trim()
  if (!normalized || isMetadataLine(normalized)) return null
  if (/^\d+$/.test(normalized)) return null

  if (!normalized.includes('#')) return null

  const [leftRaw, ...restParts] = normalized.split(/[\/|]/)
  const rightRaw = restParts.join(' ')

  const left = leftRaw.trim()
  const hashIndex = left.indexOf('#')
  if (hashIndex <= 0) return null

  const prefix = left.slice(0, hashIndex).trim()
  const suffix = left.slice(hashIndex + 1).trim()
  const suffixTokens = suffix.split(' ').filter(Boolean)
  if (suffixTokens.length === 0) return null

  const tagTokens = [suffixTokens[0]]
  let detailTokensFromLeft = []
  for (let i = 1; i < suffixTokens.length; i += 1) {
    const token = suffixTokens[i]
    if (isLikelyDetailToken(token)) {
      detailTokensFromLeft = suffixTokens.slice(i)
      break
    }
    tagTokens.push(token)
  }

  const name = `${prefix}#${tagTokens.join(' ')}`.trim()
  const detail = [detailTokensFromLeft.join(' '), rightRaw]
    .join(' ')
    .replace(/^[\s/|,.-]+/, '')
    .trim()

  return { name, detail }
}

function parsePlayers(text) {
  if (!text) return []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const parsed = parseNameAndDetail(line)
    if (!parsed) return null
    const { name, detail } = parsed
    const tier = extractTier(detail)
    const positions = extractPositions(detail)

    return {
      id: crypto.randomUUID(),
      name,
      tier,
      positions,
      team: TEAM.POOL,
    }
  }).filter(Boolean)
}

function DraggablePlayer({ player, onAssign, onRemove, selected, onToggleSelect, ghosted }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : (isDragging ? { opacity: 0 } : undefined)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`player-card ${selected ? 'selected' : ''} ${ghosted ? 'ghosted' : ''}`}
      onPointerDownCapture={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          onToggleSelect(player.id)
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="player-main">
        <div className="player-head">
          <div className="player-name-wrap">
            <div className="player-name">{player.name}</div>
            {player.tier && <span className={`tier-pill ${getTierClass(player.tier)}`}>{player.tier}</span>}
          </div>
          <button
            type="button"
            className="delete-top"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemove(player.id)
            }}
          >
            삭제
          </button>
        </div>
        {player.positions.length > 0 && (
          <div className="player-positions">
            {player.positions.map((pos) => (
              <span key={pos} className="pill">{pos}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PlayerPreview({ player, groupCount }) {
  if (!player) return null
  return (
    <div className="player-card drag-overlay-card">
      <div className="player-main">
        <div className="player-head">
          <div className="player-name-wrap">
            <div className="player-name">{player.name}</div>
            {player.tier && <span className={`tier-pill ${getTierClass(player.tier)}`}>{player.tier}</span>}
          </div>
          <button type="button" className="delete-top">삭제</button>
        </div>
        {player.positions.length > 0 && (
          <div className="player-positions">
            {player.positions.map((pos) => (
              <span key={pos} className="pill">{pos}</span>
            ))}
          </div>
        )}
      </div>
      {groupCount > 1 && <div className="drag-group-count">{groupCount}명 이동 중</div>}
    </div>
  )
}

function DropColumn({ id, title, count, onOpenPopup, onResetTeams, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className={`column fixed-body ${isOver ? 'over' : ''}`}>
      <div className="column-title">
        <span>{title}</span>
        <div className="column-title-right">
          {onResetTeams && (
            <button type="button" className="tiny ghost" onClick={onResetTeams}>팀초기화</button>
          )}
          {onOpenPopup && (
            <button type="button" className="tiny" onClick={onOpenPopup}>팝업</button>
          )}
          <span className="column-count">{count}명</span>
        </div>
      </div>
      <div className="column-body">{children}</div>
    </div>
  )
}

function App() {
  const [players, setPlayers] = useState([])
  const [input, setInput] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [draggingIds, setDraggingIds] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false)

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
    setPlayers((prev) => {
      const byKey = new Map(prev.map((player) => [toPlayerKey(player.name), player]))

      for (const incoming of parsed) {
        const key = toPlayerKey(incoming.name)
        const existing = byKey.get(key)

        if (!existing) {
          byKey.set(key, incoming)
          continue
        }

        byKey.set(key, {
          ...existing,
          tier: incoming.tier || existing.tier,
          positions: [...new Set([...existing.positions, ...incoming.positions])],
        })
      }

      return Array.from(byKey.values())
    })
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

  const handleInputKeyDown = (event) => {
    if (event.key !== 'Enter') return
    if (event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    handleAddClick()
  }

  const assignPlayer = (id, team) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, team } : p)))
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
  }

  const removePlayer = (id) => {
    const currentScroll = window.scrollY
    setPlayers((prev) => prev.filter((p) => p.id !== id))
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id))
    requestAnimationFrame(() => {
      window.scrollTo({ top: currentScroll })
    })
  }

  const clearAll = () => {
    setPlayers([])
    setSelectedIds([])
  }

  const resetTeamsToPool = () => {
    setPlayers((prev) => prev.map((p) => (p.team === TEAM.POOL ? p : { ...p, team: TEAM.POOL })))
    setSelectedIds([])
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    const idsToMove = draggingIds.length > 0 ? draggingIds : [active.id]
    setDraggingIds([])
    if (!over) return
    const target = over.id
    if (![TEAM.POOL, TEAM.A, TEAM.B].includes(target)) return
    const moveSet = new Set(idsToMove)
    setPlayers((prev) => prev.map((p) => (moveSet.has(p.id) ? { ...p, team: target } : p)))
  }

  const onDragStart = ({ active }) => {
    setActiveId(active.id)
    if (selectedIds.includes(active.id)) {
      setDraggingIds(selectedIds)
      return
    }
    setDraggingIds([active.id])
  }

  const onDragCancel = () => {
    setActiveId(null)
    setDraggingIds([])
  }

  const activePlayer = players.find((player) => player.id === activeId) ?? null

  const popupWaitingByTier = useMemo(() => {
    const tierRank = (tier) => {
      const idx = TIER_ORDER.indexOf(tier)
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
    }

    const sorted = [...grouped[TEAM.POOL]].sort((a, b) => {
      const tierDiff = tierRank(a.tier || '') - tierRank(b.tier || '')
      if (tierDiff !== 0) return tierDiff
      return a.name.localeCompare(b.name)
    })

    const buckets = new Map()
    sorted.forEach((player) => {
      const key = player.tier || '미지정'
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(player)
    })

    const sections = TIER_ORDER
      .map((tier) => ({ tier, players: buckets.get(tier) ?? [] }))
      .filter((section) => section.players.length > 0)

    const unknown = buckets.get('미지정') ?? []
    if (unknown.length > 0) sections.push({ tier: '미지정', players: unknown })

    return sections
  }, [grouped])

  return (
    <div className="app">
      <header className="header">
        <div className="header-badge">Custom Match Organizer</div>
        <h1>LoL 내전 팀 빌더</h1>
        <p>명단 붙여넣기부터 드래그 배치까지, 한 화면에서 빠르게 진행하세요.</p>
      </header>

      <section className="summary-section">
        <div className="summary-card">
          <span className="summary-label">총 인원</span>
          <strong>{players.length}명</strong>
        </div>
        <div className="summary-card">
          <span className="summary-label">대기</span>
          <strong>{grouped[TEAM.POOL].length}명</strong>
        </div>
      </section>

      <section className="input-section">
        <div className="section-head">
          <h2>명단 입력</h2>
          <span>채팅 전체를 붙여넣어도 닉네임#태그 줄만 자동 추출됩니다.</span>
        </div>
        <textarea
          placeholder={'예) 닉네임#태그 / 티어 / 라인,라인'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onPaste={handlePaste}
          rows={3}
        />
        <div className="input-actions">
          <button type="button" onClick={handleAddClick}>입력 내용 추가</button>
          <button type="button" className="ghost" onClick={clearAll}>전체 초기화</button>
        </div>
      </section>

      <DndContext autoScroll={false} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        <div className="guide">
          <span>Tip</span>
          플레이어 드래그, Ctrl+클릭 선택 및 다중선택, 팝업에서 티어별 일괄 확인이 가능합니다.
        </div>
        <div className="columns">
          <DropColumn
            id={TEAM.POOL}
            title="대기"
            count={grouped[TEAM.POOL].length}
            onOpenPopup={() => setIsPoolModalOpen(true)}
            onResetTeams={resetTeamsToPool}
          >
            {grouped[TEAM.POOL].length === 0 && <div className="empty">대기 인원이 없습니다.</div>}
            {grouped[TEAM.POOL].map((player) => (
              <DraggablePlayer
                key={player.id}
                player={player}
                onAssign={assignPlayer}
                onRemove={removePlayer}
                selected={selectedIds.includes(player.id)}
                onToggleSelect={toggleSelect}
                ghosted={activeId !== null && draggingIds.includes(player.id)}
              />
            ))}
          </DropColumn>
          <DropColumn id={TEAM.A} title="팀 A" count={grouped[TEAM.A].length}>
            {grouped[TEAM.A].length === 0 && <div className="empty">팀 A 인원이 없습니다.</div>}
            {grouped[TEAM.A].map((player) => (
              <DraggablePlayer
                key={player.id}
                player={player}
                onAssign={assignPlayer}
                onRemove={removePlayer}
                selected={selectedIds.includes(player.id)}
                onToggleSelect={toggleSelect}
                ghosted={activeId !== null && draggingIds.includes(player.id)}
              />
            ))}
          </DropColumn>
          <DropColumn id={TEAM.B} title="팀 B" count={grouped[TEAM.B].length}>
            {grouped[TEAM.B].length === 0 && <div className="empty">팀 B 인원이 없습니다.</div>}
            {grouped[TEAM.B].map((player) => (
              <DraggablePlayer
                key={player.id}
                player={player}
                onAssign={assignPlayer}
                onRemove={removePlayer}
                selected={selectedIds.includes(player.id)}
                onToggleSelect={toggleSelect}
                ghosted={activeId !== null && draggingIds.includes(player.id)}
              />
            ))}
          </DropColumn>
        </div>
        <DragOverlay>
          <PlayerPreview
            player={activePlayer}
            groupCount={draggingIds.length}
          />
        </DragOverlay>
      </DndContext>

      {isPoolModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPoolModalOpen(false)}>
          <div className="pool-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pool-modal-header">
              <h3>팀 배정 팝업 (드래그 없이 버튼으로 배정)</h3>
              <button type="button" className="ghost" onClick={() => setIsPoolModalOpen(false)}>닫기</button>
            </div>
            {popupWaitingByTier.length === 0 ? (
              <div className="popup-empty-tier">대기 인원 없음</div>
            ) : (
              popupWaitingByTier.map((section) => (
                <section key={section.tier} className="popup-tier-group">
                  <div className="popup-tier-title">
                    <span className={`tier-pill ${getTierClass(section.tier)}`}>{section.tier}</span>
                    <strong>{section.players.length}명</strong>
                  </div>
                  <div className="popup-list">
                    {section.players.map((player) => (
                      <div key={player.id} className="popup-line-row">
                        <div className="popup-line-main">
                          <span className="pool-row-name">{player.name}</span>
                          <span className="pool-row-pos">{player.positions.length > 0 ? player.positions.join(' / ') : '-'}</span>
                        </div>
                        <div className="pool-row-actions">
                          <button type="button" onClick={() => assignPlayer(player.id, TEAM.A)}>A</button>
                          <button type="button" onClick={() => assignPlayer(player.id, TEAM.B)}>B</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}

      <footer className="site-footer">
        제작자 sexychan | discord: sexychan | 문의 및 버그제보는 디스코드 DM으로 부탁드립니다.
      </footer>
    </div>
  )
}

export default App
