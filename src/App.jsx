import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import './App.css'

const ROUTE = {
  HOME: '/',
  NORMAL: '/normal',
}

function normalizeRoute(pathname) {
  if (pathname === ROUTE.NORMAL) return ROUTE.NORMAL
  return ROUTE.HOME
}

const TEAM = {
  POOL: 'pool',
  A: 'teamA',
  B: 'teamB',
}

const CHANGELOG_ENTRIES = [
  {
    date: '2026-02-08',
    items: [
      '홈 화면과 일반내전 화면을 분리해 이동이 더 쉬워졌어요.',
      '팀 A/B 사이에 교체 버튼과 카메라 버튼이 추가됐어요.',
      '카메라 버튼으로 팀 A/B 화면을 바로 복사할 수 있어요.',
    ],
  },
  {
    date: '2026-02-07',
    items: [
      '사용방법 팝업이 추가되어 처음 써도 쉽게 따라갈 수 있어요.',
      '전체초기화와 팀초기화 차이를 한눈에 볼 수 있어요.',
      '모바일에서도 주요 버튼을 더 쉽게 찾을 수 있어요.',
    ],
  },
  {
    date: '2026-02-06',
    items: [
      '팝업에서 티어별로 확인하고 바로 팀 배정할 수 있어요.',
      '여러 명을 선택해서 한 번에 이동하는 기능이 더 안정적이에요.',
    ],
  },
]

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
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname))
  const [isCapturing, setIsCapturing] = useState(false)
  const teamAColumnRef = useRef(null)
  const teamBColumnRef = useRef(null)

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextRoute) => {
    const target = normalizeRoute(nextRoute)
    if (target === route) return
    window.history.pushState({}, '', target)
    setRoute(target)
  }

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

  const swapTeamsBetweenAAndB = () => {
    setPlayers((prev) => prev.map((p) => {
      if (p.team === TEAM.A) return { ...p, team: TEAM.B }
      if (p.team === TEAM.B) return { ...p, team: TEAM.A }
      return p
    }))
    setSelectedIds([])
  }

  const captureBoard = async () => {
    if (isCapturing) return

    const teamAEl = teamAColumnRef.current
    const teamBEl = teamBColumnRef.current
    if (!teamAEl || !teamBEl) return

    const loadHtml2Canvas = () => new Promise((resolve, reject) => {
      if (window.html2canvas) {
        resolve(window.html2canvas)
        return
      }

      const scriptId = 'html2canvas-cdn-loader'
      const existing = document.getElementById(scriptId)
      if (existing) {
        existing.addEventListener('load', () => resolve(window.html2canvas), { once: true })
        existing.addEventListener('error', () => reject(new Error('html2canvas load error')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
      script.async = true
      script.onload = () => resolve(window.html2canvas)
      script.onerror = () => reject(new Error('html2canvas load error'))
      document.head.appendChild(script)
    })

    setIsCapturing(true)
    try {
      const html2canvas = await loadHtml2Canvas()
      if (!html2canvas) throw new Error('html2canvas unavailable')

      const captureOptions = {
        backgroundColor: '#0a1a2b',
        scale: Math.max(1, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false,
      }
      const canvasA = await html2canvas(teamAEl, captureOptions)
      const canvasB = await html2canvas(teamBEl, captureOptions)

      const gap = 16
      const outWidth = canvasA.width + gap + canvasB.width
      const outHeight = Math.max(canvasA.height, canvasB.height)

      const canvas = document.createElement('canvas')
      canvas.width = outWidth
      canvas.height = outHeight
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#0a1a2b'
      ctx.fillRect(0, 0, outWidth, outHeight)
      ctx.drawImage(canvasA, 0, 0)
      ctx.drawImage(canvasB, canvasA.width + gap, 0)
      ctx.fillStyle = '#1f5587'
      ctx.fillRect(canvasA.width + Math.floor(gap / 2), 0, 1, outHeight)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('캡처 이미지 생성에 실패했습니다.')

      const canCopy = typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write
      if (canCopy) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          window.alert('팀 A/B 보드를 클립보드에 복사했습니다.')
          return
        } catch {
          window.alert('이미지 복사에 실패했습니다. 브라우저 권한 설정을 확인해주세요.')
          return
        }
      }
      window.alert('이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.')
    } catch (error) {
      window.alert('캡처를 완료하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.')
    } finally {
      setIsCapturing(false)
    }
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

  const renderAnimatedChars = (text, classPrefix) => (
    text.split('').map((ch, index) => (
      <span
        key={`${classPrefix}-${ch}-${index}`}
        className={`${classPrefix}-char${ch === ' ' ? ` ${classPrefix}-space` : ''}`}
        style={{ '--char-index': index }}
      >
        {ch === ' ' ? '\u00A0' : ch}
      </span>
    ))
  )

  if (route === ROUTE.HOME) {
    return (
      <div className="home-screen">
        <div className="home-title-split" aria-label="LoL Team Builder">
          <span className="home-diagonal" aria-hidden="true" />
          <div className="home-lol-layer">
            <span className="home-title-lol">{renderAnimatedChars('LoL TEAM', 'lol')}</span>
          </div>
          <div className="home-builder-layer">
            <span className="home-title-builder">{renderAnimatedChars('BUILDER', 'builder')}</span>
          </div>
        </div>
        <p className="home-subtitle">내전 팀 구성을 빠르게 시작하세요.</p>
        <div className="home-actions">
          <button type="button" className="home-start" onClick={() => navigate(ROUTE.NORMAL)}>
            일반내전
          </button>
          <button type="button" className="home-start disabled" disabled>
            경매내전 (준비중)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="page-tools">
        <button type="button" className="ghost tiny" onClick={() => navigate(ROUTE.HOME)}>
          홈으로
        </button>
        <button type="button" className="tiny team-swap-top" onClick={swapTeamsBetweenAAndB}>
          팀 A/B 서로 교체
        </button>
        <button type="button" className="tiny team-camera-top" onClick={captureBoard} disabled={isCapturing}>
          <span className="material-symbols-outlined" aria-hidden="true">
            {isCapturing ? 'hourglass_top' : 'photo_camera'}
          </span>
          <span>{isCapturing ? '캡처 중...' : '보드 캡처'}</span>
        </button>
      </div>
      <header className="header">
        <div className="header-top">
          <div className="header-badge">Custom Match Organizer</div>
          <div className="header-actions">
            <button type="button" className="ghost help-open-btn" onClick={() => setIsHelpModalOpen(true)}>
              사용방법
            </button>
            <button type="button" className="ghost update-open-btn" onClick={() => setIsUpdateModalOpen(true)}>
              업데이트 내역
            </button>
          </div>
        </div>
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
        <div className="columns columns-with-swap">
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
          <div ref={teamAColumnRef} className="team-capture-slot">
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
          </div>
          <div className="team-swap-between">
            <button
              type="button"
              className="team-swap-icon"
              onClick={swapTeamsBetweenAAndB}
              aria-label="팀 A와 팀 B 교체"
              title="팀 A와 팀 B 교체"
            >
              <span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
            </button>
            <button
              type="button"
              className="team-camera-icon"
              onClick={captureBoard}
              aria-label="팀 보드 캡처"
              title="팀 보드 캡처"
              disabled={isCapturing}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {isCapturing ? 'hourglass_top' : 'photo_camera'}
              </span>
            </button>
          </div>
          <div ref={teamBColumnRef} className="team-capture-slot">
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

      {isHelpModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsHelpModalOpen(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>사용방법</h3>
              <button type="button" className="ghost" onClick={() => setIsHelpModalOpen(false)}>닫기</button>
            </div>

            <section className="help-block">
              <h4>1. 명단 입력</h4>
              <p>`닉네임#태그 / 티어 / 라인` 형식으로 입력하거나 채팅 내용을 그대로 붙여넣으세요.</p>
              <p>예시: `선수#KR1 / 다이아 / 탑 미드`</p>
            </section>

            <section className="help-block">
              <h4>2. 팀 배정</h4>
              <p>대기 목록의 선수를 팀 A 또는 팀 B 컬럼으로 드래그해서 배정합니다.</p>
              <p>선수 카드 우측 상단 `삭제` 버튼으로 즉시 제거할 수 있습니다.</p>
            </section>

            <section className="help-block">
              <h4>3. 빠른 조작</h4>
              <p>`Ctrl+클릭`(Mac은 `Cmd+클릭`)으로 다중 선택 후 한 번에 이동할 수 있습니다.</p>
              <p>가운데 `교체` 버튼으로 팀 A/B 전체를 서로 바꿀 수 있습니다.</p>
            </section>

            <section className="help-block">
              <h4>4. 팝업 배정</h4>
              <p>대기 컬럼의 `팝업` 버튼을 누르면 티어별 목록이 열립니다.</p>
              <p>팝업에서 A/B 버튼으로 드래그 없이 바로 배정할 수 있습니다.</p>
            </section>

            <section className="help-block">
              <h4>5. 캡처 복사</h4>
              <p>카메라 버튼을 누르면 팀 A/B 영역 이미지를 클립보드에 복사합니다.</p>
              <p>브라우저 권한 정책에 따라 복사가 제한될 수 있습니다.</p>
            </section>

            <section className="help-block">
              <h4>6. 초기화 버튼 차이</h4>
              <p>`전체초기화`: 현재 등록된 모든 선수를 완전히 삭제합니다.</p>
              <p>`팀초기화`: 선수는 유지하고, 팀 A/B 인원만 모두 대기로 되돌립니다.</p>
            </section>
          </div>
        </div>
      )}

      {isUpdateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsUpdateModalOpen(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>업데이트 내역</h3>
              <button type="button" className="ghost" onClick={() => setIsUpdateModalOpen(false)}>닫기</button>
            </div>

            {CHANGELOG_ENTRIES.map((entry) => (
              <section key={entry.date} className="help-block update-block">
                <h4>{entry.date}</h4>
                <ul className="update-list">
                  {entry.items.map((item, index) => (
                    <li key={`${entry.date}-${index}`}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
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
