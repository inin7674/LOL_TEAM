import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core'
import './App.css'

const ROUTE = {
  HOME: '/',
  NORMAL: '/normal',
  AUCTION: '/auction',
}

const AUCTION_API_BASE = '/api/auction'

const STORAGE_KEY_PLAYERS = 'lol-team:players:v1'
const STORAGE_KEY_DRAFT = 'lol-team:draft:v1'
const STORAGE_KEY_AUCTION_SESSION = 'lol-team:auction-session:v1'

function normalizeRoute(pathname) {
  if (pathname === ROUTE.AUCTION) return ROUTE.AUCTION
  if (pathname === ROUTE.NORMAL) return ROUTE.NORMAL
  return ROUTE.HOME
}

const TEAM = {
  POOL: 'pool',
  A: 'teamA',
  B: 'teamB',
}

const AUCTION_TEAM_IDS = ['A', 'B', 'C', 'D']

function createInitialAuctionTeams() {
  return AUCTION_TEAM_IDS.map((teamId) => ({
    id: teamId,
    name: `팀 ${teamId}`,
    captainName: '미참가',
    captainPlayer: null,
    points: 500,
    players: [],
  }))
}

const CHANGELOG_ENTRIES = [
  {
    date: '2026-02-08',
    items: [
      '홈 화면과 일반내전 화면을 분리해 이동이 더 쉬워졌어요.',
      '팀 A/B 사이에 교체 버튼과 카메라 버튼이 추가됐어요.',
      '카메라 버튼으로 팀 A/B 화면을 바로 복사할 수 있어요.',
      '새로고침해도 입력한 명단과 배정 상태가 유지돼요.',
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

function getTierLabel(tier, compact = false) {
  if (!compact) {
    if (tier === '그랜드마스터') return '그마'
    return tier
  }

  const compactMap = {
    챌린저: '챌',
    그랜드마스터: '그마',
    마스터: '마',
    다이아: '다',
    에메랄드: '에',
    플래티넘: '플',
    골드: '골',
    실버: '실',
    브론즈: '브',
    아이언: '아',
  }
  return compactMap[tier] ?? tier
}

function getTierIcon(tier) {
  const map = {
    챌린저: '👑',
    그랜드마스터: '🏆',
    마스터: '💠',
    다이아: '💎',
    에메랄드: '🟢',
    플래티넘: '🔷',
    골드: '🥇',
    실버: '🥈',
    브론즈: '🥉',
    아이언: '⚙️',
  }
  return map[tier] ?? '🎯'
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

  const parsed = lines.map((line) => {
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

  const byKey = new Map()
  for (const player of parsed) {
    const key = toPlayerKey(player.name)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, player)
      continue
    }
    byKey.set(key, {
      ...existing,
      tier: existing.tier || player.tier,
      positions: [...new Set([...(existing.positions || []), ...(player.positions || [])])],
    })
  }
  return Array.from(byKey.values())
}

function parseCaptainDraft(rawText) {
  const line = String(rawText ?? '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean) ?? ''
  if (!line) return null

  const parsed = parsePlayers(line)[0]
  if (parsed) {
    return {
      id: parsed.id || crypto.randomUUID(),
      name: parsed.name,
      tier: parsed.tier || '',
      positions: parsed.positions || [],
    }
  }

  const [namePart, ...detailParts] = line.split(/[\/|]/)
  const name = (namePart || '').trim()
  const detail = detailParts.join(' ').trim()
  if (!name) return null
  return {
    id: crypto.randomUUID(),
    name,
    tier: extractTier(detail),
    positions: extractPositions(detail),
  }
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
            {player.tier && <span className={`tier-pill ${getTierClass(player.tier)}`}>{getTierLabel(player.tier)}</span>}
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
            {player.tier && <span className={`tier-pill ${getTierClass(player.tier)}`}>{getTierLabel(player.tier)}</span>}
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
  const [players, setPlayers] = useState(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_PLAYERS)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY_DRAFT) ?? ''
    } catch {
      return ''
    }
  })
  const [activeId, setActiveId] = useState(null)
  const [draggingIds, setDraggingIds] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isAuctionEntryOpen, setIsAuctionEntryOpen] = useState(false)
  const [isAuctionJoinOpen, setIsAuctionJoinOpen] = useState(false)
  const [isAuctionRosterOpen, setIsAuctionRosterOpen] = useState(false)
  const [isCaptainJoinOpen, setIsCaptainJoinOpen] = useState(false)
  const [isCaptainJoinBlockedOpen, setIsCaptainJoinBlockedOpen] = useState(false)
  const [captainJoinTeamId, setCaptainJoinTeamId] = useState('')
  const [captainJoinDraft, setCaptainJoinDraft] = useState('')
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname))
  const [isCapturing, setIsCapturing] = useState(false)
  const [isAuctionHost, setIsAuctionHost] = useState(false)
  const [auctionHostName, setAuctionHostName] = useState('방장')
  const [auctionRoomDraft, setAuctionRoomDraft] = useState('')
  const [auctionRoomCode, setAuctionRoomCode] = useState('')
  const [auctionHostSessionToken, setAuctionHostSessionToken] = useState('')
  const [auctionSessionToken, setAuctionSessionToken] = useState('')
  const [auctionError, setAuctionError] = useState('')
  const [auctionBusy, setAuctionBusy] = useState(false)
  const [auctionConnected, setAuctionConnected] = useState(false)
  const [auctionSeconds, setAuctionSeconds] = useState(10)
  const [auctionInput, setAuctionInput] = useState('')
  const [auctionQueue, setAuctionQueue] = useState([])
  const [auctionCurrent, setAuctionCurrent] = useState(null)
  const [auctionTimeLeft, setAuctionTimeLeft] = useState(0)
  const [auctionRunning, setAuctionRunning] = useState(false)
  const [auctionPaused, setAuctionPaused] = useState(false)
  const [auctionRoundEndsAt, setAuctionRoundEndsAt] = useState(0)
  const [auctionTeams, setAuctionTeams] = useState(createInitialAuctionTeams)
  const [auctionMyTeamId, setAuctionMyTeamId] = useState('')
  const [auctionBidAmount, setAuctionBidAmount] = useState('')
  const [auctionBidMap, setAuctionBidMap] = useState({})
  const [auctionLogs, setAuctionLogs] = useState([])
  const [isAuctionCenterUnlocked, setIsAuctionCenterUnlocked] = useState(false)
  const [auctionCanUndo, setAuctionCanUndo] = useState(false)
  const [isRoomCodeCopied, setIsRoomCodeCopied] = useState(false)
  const [topMessage, setTopMessage] = useState({ text: '', type: '' })
  const teamAColumnRef = useRef(null)
  const teamBColumnRef = useRef(null)
  const auctionWsRef = useRef(null)
  const roomCodeToastTimerRef = useRef(null)
  const topMessageTimerRef = useRef(null)

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players))
    } catch {
      // Ignore storage errors (private mode/quota) and keep app usable.
    }
  }, [players])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_DRAFT, input)
    } catch {
      // Ignore storage errors (private mode/quota) and keep app usable.
    }
  }, [input])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_AUCTION_SESSION)
      if (!raw) return
      const saved = JSON.parse(raw)
      const savedRoomCode = String(saved?.roomCode || '').trim().toUpperCase()
      setIsAuctionHost(Boolean(saved?.isAuctionHost))
      setAuctionRoomCode(savedRoomCode)
      setAuctionRoomDraft(savedRoomCode)
      setAuctionHostSessionToken(String(saved?.hostSessionToken || ''))
      setAuctionSessionToken(String(saved?.sessionToken || ''))
      setAuctionMyTeamId(String(saved?.myTeamId || ''))
    } catch {
      // Ignore storage parse errors and continue with empty session.
    }
  }, [])

  useEffect(() => {
    try {
      const payload = {
        isAuctionHost,
        roomCode: auctionRoomCode,
        hostSessionToken: auctionHostSessionToken,
        sessionToken: auctionSessionToken,
        myTeamId: auctionMyTeamId,
      }
      const hasSession = Boolean(payload.roomCode || payload.hostSessionToken || payload.sessionToken)
      if (!hasSession) {
        window.localStorage.removeItem(STORAGE_KEY_AUCTION_SESSION)
        return
      }
      window.localStorage.setItem(STORAGE_KEY_AUCTION_SESSION, JSON.stringify(payload))
    } catch {
      // Ignore storage errors (private mode/quota) and keep app usable.
    }
  }, [isAuctionHost, auctionRoomCode, auctionHostSessionToken, auctionSessionToken, auctionMyTeamId])

  const navigate = (nextRoute) => {
    const target = normalizeRoute(nextRoute)
    if (target === route) return
    window.history.pushState({}, '', target)
    setRoute(target)
  }

  const showTopMessage = (text, type = 'error', duration = 2200) => {
    if (!text) return
    if (topMessageTimerRef.current) {
      window.clearTimeout(topMessageTimerRef.current)
    }
    setTopMessage({ text, type })
    topMessageTimerRef.current = window.setTimeout(() => {
      setTopMessage({ text: '', type: '' })
    }, duration)
  }

  const closeAuctionSocket = () => {
    if (!auctionWsRef.current) return
    auctionWsRef.current.close()
    auctionWsRef.current = null
    setAuctionConnected(false)
  }

  const applyAuctionState = (nextState) => {
    if (!nextState) return
    setAuctionSeconds(nextState.config?.seconds ?? 10)
    setAuctionTeams(Array.isArray(nextState.teams) ? nextState.teams : createInitialAuctionTeams())
    setAuctionQueue(Array.isArray(nextState.queue) ? nextState.queue : [])
    setAuctionCurrent(nextState.current ?? null)
    setAuctionBidMap(nextState.bids ?? {})
    setAuctionLogs(Array.isArray(nextState.logs) ? nextState.logs : [])
    const running = Boolean(nextState.round?.running)
    const paused = Boolean(nextState.round?.paused)
    const started = Boolean(nextState.round?.started)
    const endsAt = Number(nextState.round?.endsAt ?? 0)
    const remainingMs = Number(nextState.round?.remainingMs ?? 0)
    setAuctionRunning(running)
    setAuctionPaused(paused)
    setIsAuctionCenterUnlocked(started)
    setAuctionRoundEndsAt(endsAt)
    setAuctionCanUndo(Boolean(nextState.canUndo))
    if (running) {
      setAuctionTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
      return
    }
    if (paused) {
      setAuctionTimeLeft(Math.max(0, Math.ceil(remainingMs / 1000)))
      return
    }
    if (!running && !paused) {
      setAuctionTimeLeft(0)
      return
    }
  }

  const auctionRequest = async (path, options = {}, sessionToken = '') => {
    const headers = {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    }
    if (sessionToken) headers['x-room-session'] = sessionToken
    let response
    try {
      response = await fetch(`${AUCTION_API_BASE}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body,
      })
    } catch {
      throw new Error('백엔드 연결 실패: `npm run dev:cf` 또는 Worker 서버 상태를 확인하세요.')
    }
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('API 라우트를 찾을 수 없습니다. 로컬이면 `npm run dev:cf`를 사용하세요.')
      }
      throw new Error(data.error || `요청 실패 (${response.status})`)
    }
    return data
  }

  const connectAuctionSocket = (roomCode, sessionToken) => {
    closeAuctionSocket()
    if (!roomCode || !sessionToken) return
    const wsUrl = new URL(`${AUCTION_API_BASE}/rooms/${roomCode}/ws`, window.location.origin)
    wsUrl.searchParams.set('session', sessionToken)
    wsUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(wsUrl.toString())
    ws.onopen = () => setAuctionConnected(true)
    ws.onclose = () => setAuctionConnected(false)
    ws.onerror = () => setAuctionConnected(false)
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'state') {
          applyAuctionState(payload.state)
        }
      } catch {
        // noop
      }
    }
    auctionWsRef.current = ws
  }

  const openAuctionRoom = async (asHost) => {
    setAuctionError('')
    setAuctionBusy(true)
    try {
      if (asHost) {
        const created = await auctionRequest('/rooms/create', {
          method: 'POST',
          body: JSON.stringify({ hostName: auctionHostName.trim() || '방장' }),
        })
        setIsAuctionHost(true)
        setAuctionRoomCode(created.roomCode)
        setAuctionRoomDraft(created.roomCode)
        setAuctionHostSessionToken(created.hostSession ?? '')
        setAuctionSessionToken(created.hostSession ?? '')
        setAuctionMyTeamId('')
        applyAuctionState(created.state)
        setIsAuctionEntryOpen(false)
        setIsAuctionJoinOpen(false)
        navigate(ROUTE.AUCTION)
        connectAuctionSocket(created.roomCode, created.hostSession ?? '')
        return
      }

      const roomCode = auctionRoomDraft.trim().toUpperCase()
      if (!roomCode) throw new Error('방 코드를 입력하세요.')
      const stateRes = await auctionRequest(`/rooms/${roomCode}/state`)
      setIsAuctionHost(false)
      setAuctionRoomCode(roomCode)
      setAuctionHostSessionToken('')
      setAuctionSessionToken('')
      setAuctionMyTeamId('')
      applyAuctionState(stateRes.state)
      setIsAuctionEntryOpen(false)
      setIsAuctionJoinOpen(false)
      navigate(ROUTE.AUCTION)
    } catch (error) {
      const message = String(error?.message || '')
      const missingRoom =
        !asHost && (
          message.includes('room not initialized')
          || message.includes('invalid room code')
          || message.includes('요청 실패 (404)')
          || message.includes('API 라우트를 찾을 수 없습니다.')
        )
      setAuctionError(missingRoom ? '해당하는 방이 없습니다.' : (error.message || '경매 방 입장에 실패했습니다.'))
    } finally {
      setAuctionBusy(false)
    }
  }

  const toggleAuctionEntryInline = () => {
    setAuctionError('')
    const next = !isAuctionEntryOpen
    setIsAuctionEntryOpen(next)
    if (!next) {
      setIsAuctionJoinOpen(false)
      setAuctionRoomDraft('')
    }
  }

  const loadAuctionPlayersFromInput = async () => {
    const hostToken = isAuctionHost ? auctionHostSessionToken : auctionSessionToken
    if (!auctionRoomCode || !hostToken) return

    const existingNameKeys = new Set()
    const putKey = (name) => {
      const key = toPlayerKey(name || '')
      if (!key || key === toPlayerKey('미참가')) return
      existingNameKeys.add(key)
    }
    for (const team of auctionTeams) {
      putKey(team.captainName)
      putKey(team.captainPlayer?.name)
      for (const player of team.players ?? []) {
        putKey(player.name)
      }
    }
    putKey(auctionCurrent?.name)
    for (const queued of auctionQueue) {
      putKey(queued.name)
    }

    const players = parsePlayers(auctionInput).map((player) => ({
      id: player.id,
      name: player.name,
      tier: player.tier,
      positions: player.positions,
    }))
    if (players.length === 0) return
    const uniquePlayers = []
    for (const player of players) {
      const key = toPlayerKey(player.name)
      if (!key || existingNameKeys.has(key)) continue
      existingNameKeys.add(key)
      uniquePlayers.push(player)
    }
    if (uniquePlayers.length === 0) {
      showTopMessage('중복 제외 후 추가할 플레이어가 없습니다.', 'error')
      return
    }
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/roster`,
        {
          method: 'POST',
          body: JSON.stringify({ players: uniquePlayers }),
        },
        hostToken,
      )
      applyAuctionState(response.state)
      setAuctionInput('')
    } catch (error) {
      setAuctionError(error.message || '명단 추가에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const drawAuctionPlayer = async () => {
    const hostToken = isAuctionHost ? auctionHostSessionToken : auctionSessionToken
    if (!auctionRoomCode || !hostToken) return
    if (auctionQueue.length < 1) {
      showTopMessage('오류: 플레이어를 추가해주세요', 'error')
      return
    }
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/start`,
        {
          method: 'POST',
          body: JSON.stringify({ seconds: auctionSeconds }),
        },
        hostToken,
      )
      applyAuctionState(response.state)
    } catch (error) {
      setAuctionError(error.message || '경매 시작에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const submitAuctionBid = async (teamId, amountText) => {
    if (!auctionRoomCode || !auctionSessionToken || !teamId) return
    const amount = Number.parseInt(amountText, 10)
    if (!Number.isFinite(amount) || amount <= 0) return
    setAuctionError('')
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/bid`,
        {
          method: 'POST',
          body: JSON.stringify({ amount }),
        },
        auctionSessionToken,
      )
      applyAuctionState(response.state)
      setAuctionBidAmount('')
    } catch (error) {
      setAuctionError(error.message || '입찰 등록에 실패했습니다.')
    }
  }

  const openCaptainJoinModal = (teamId) => {
    if (auctionMyTeamId && auctionMyTeamId !== teamId) {
      setIsCaptainJoinBlockedOpen(true)
      return
    }
    setCaptainJoinTeamId(teamId)
    setCaptainJoinDraft('')
    setIsCaptainJoinOpen(true)
  }

  const leaveCaptainTeam = async () => {
    if (!auctionRoomCode || !auctionSessionToken || !auctionMyTeamId) return
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/leave`,
        { method: 'POST' },
        auctionSessionToken,
      )
      setAuctionSessionToken('')
      if (isAuctionHost) {
        setAuctionSessionToken(auctionHostSessionToken)
      }
      setAuctionMyTeamId('')
      applyAuctionState(response.state)
      closeAuctionSocket()
      setIsCaptainJoinOpen(false)
      setCaptainJoinTeamId('')
      setCaptainJoinDraft('')
    } catch (error) {
      setAuctionError(error.message || '팀 탈퇴에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const joinCaptainToTeam = async () => {
    if (!auctionRoomCode) return
    const teamId = captainJoinTeamId
    if (!teamId) return
    const exists = auctionTeams.some((team) => team.id === teamId)
    if (!exists) return
    const raw = captainJoinDraft.trim()
    if (!raw) return

    const captainPlayer = parseCaptainDraft(raw)
    if (!captainPlayer) return

    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(`/rooms/${auctionRoomCode}/join`, {
        method: 'POST',
        body: JSON.stringify({
          teamId,
          captainName: captainPlayer.name,
          captainPlayer,
        }),
      })
      setAuctionSessionToken(response.sessionToken ?? '')
      setAuctionMyTeamId(response.myTeamId ?? '')
      applyAuctionState(response.state)
      connectAuctionSocket(auctionRoomCode, response.sessionToken ?? '')
      setIsCaptainJoinOpen(false)
      setCaptainJoinTeamId('')
      setCaptainJoinDraft('')
    } catch (error) {
      setAuctionError(error.message || '주장 참가에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const finishAuctionRound = async () => {
    const hostToken = isAuctionHost ? auctionHostSessionToken : auctionSessionToken
    if (!auctionRoomCode || !hostToken) return
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/finish`,
        { method: 'POST' },
        hostToken,
      )
      applyAuctionState(response.state)
      setAuctionBidAmount('')
    } catch (error) {
      setAuctionError(error.message || '라운드 종료에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const togglePauseAuctionRound = async () => {
    const hostToken = isAuctionHost ? auctionHostSessionToken : auctionSessionToken
    if (!auctionRoomCode || !hostToken) return
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/pause`,
        { method: 'POST' },
        hostToken,
      )
      applyAuctionState(response.state)
    } catch (error) {
      setAuctionError(error.message || '일시 정지/재개에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const restartAuctionRound = async () => {
    const hostToken = isAuctionHost ? auctionHostSessionToken : auctionSessionToken
    if (!auctionRoomCode || !hostToken) return
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/restart`,
        { method: 'POST' },
        hostToken,
      )
      applyAuctionState(response.state)
      setAuctionBidAmount('')
    } catch (error) {
      setAuctionError(error.message || '경매 재시작에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const undoAuctionCurrent = async () => {
    const hostToken = isAuctionHost ? auctionHostSessionToken : auctionSessionToken
    if (!auctionRoomCode || !hostToken) return
    setAuctionError('')
    setAuctionBusy(true)
    try {
      const response = await auctionRequest(
        `/rooms/${auctionRoomCode}/undo`,
        { method: 'POST' },
        hostToken,
      )
      applyAuctionState(response.state)
      setAuctionBidAmount('')
    } catch (error) {
      setAuctionError(error.message || '되돌리기에 실패했습니다.')
    } finally {
      setAuctionBusy(false)
    }
  }

  const copyAuctionRoomCode = async () => {
    if (!auctionRoomCode) return
    try {
      await navigator.clipboard.writeText(auctionRoomCode)
      setAuctionError('')
      if (roomCodeToastTimerRef.current) {
        window.clearTimeout(roomCodeToastTimerRef.current)
      }
      setIsRoomCodeCopied(true)
      roomCodeToastTimerRef.current = window.setTimeout(() => {
        setIsRoomCodeCopied(false)
      }, 1400)
    } catch {
      setAuctionError('방코드 복사에 실패했습니다.')
    }
  }

  useEffect(() => {
    if (!auctionError) return
    showTopMessage(auctionError, 'error')
    setAuctionError('')
  }, [auctionError])

  useEffect(() => {
    if (!auctionRunning || !auctionRoundEndsAt) return
    const tick = () => {
      setAuctionTimeLeft(Math.max(0, Math.ceil((auctionRoundEndsAt - Date.now()) / 1000)))
    }
    tick()
    const timer = window.setInterval(tick, 300)
    return () => window.clearInterval(timer)
  }, [auctionRunning, auctionRoundEndsAt])

  useEffect(() => {
    return () => {
      if (topMessageTimerRef.current) {
        window.clearTimeout(topMessageTimerRef.current)
      }
      if (roomCodeToastTimerRef.current) {
        window.clearTimeout(roomCodeToastTimerRef.current)
      }
      if (!auctionWsRef.current) return
      auctionWsRef.current.close()
      auctionWsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (route === ROUTE.AUCTION || !auctionWsRef.current) return
    auctionWsRef.current.close()
    auctionWsRef.current = null
    setAuctionConnected(false)
  }, [route])

  useEffect(() => {
    if (route !== ROUTE.AUCTION) return
    if (auctionConnected) return
    const token = auctionSessionToken || auctionHostSessionToken
    if (!auctionRoomCode || !token) return
    connectAuctionSocket(auctionRoomCode, token)
  }, [route, auctionRoomCode, auctionSessionToken, auctionHostSessionToken, auctionConnected])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (route !== ROUTE.AUCTION || !auctionRoomCode || auctionConnected) return
    const refreshState = async () => {
      try {
        const response = await auctionRequest(`/rooms/${auctionRoomCode}/state`)
        applyAuctionState(response.state)
      } catch {
        // noop
      }
    }
    refreshState()
    const timer = window.setInterval(refreshState, 3000)
    return () => window.clearInterval(timer)
  }, [route, auctionRoomCode, auctionConnected])

  const myTeam = auctionTeams.find((team) => team.id === auctionMyTeamId) ?? null
  const isAuctionFinished = isAuctionCenterUnlocked && !auctionRunning && !auctionPaused && !auctionCurrent && auctionQueue.length === 0

  const grouped = useMemo(() => {
    return {
      [TEAM.POOL]: players.filter((p) => p.team === TEAM.POOL),
      [TEAM.A]: players.filter((p) => p.team === TEAM.A),
      [TEAM.B]: players.filter((p) => p.team === TEAM.B),
    }
  }, [players])

  const auctionSoldPlayers = useMemo(
    () => auctionTeams.flatMap((team) => team.players),
    [auctionTeams],
  )

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
          showTopMessage('팀 A/B 보드를 클립보드에 복사했습니다.', 'success')
          return
        } catch {
          showTopMessage('이미지 복사에 실패했습니다. 브라우저 권한 설정을 확인해주세요.', 'error')
          return
        }
      }
      showTopMessage('이 브라우저는 이미지 클립보드 복사를 지원하지 않습니다.', 'error')
    } catch (error) {
      showTopMessage('캡처를 완료하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.', 'error')
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
        {topMessage.text && <div className={`top-message ${topMessage.type}`}>{topMessage.text}</div>}
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
          <button type="button" className="home-start" onClick={toggleAuctionEntryInline}>
            경매내전
          </button>
        </div>
        {isAuctionEntryOpen && (
          <div className={`auction-entry-inline ${isAuctionJoinOpen ? 'open' : ''}`}>
            {!isAuctionJoinOpen && (
              <button type="button" className="home-start" onClick={() => openAuctionRoom(true)} disabled={auctionBusy}>
                방만들기
              </button>
            )}
            <div className={`auction-join-morph ${isAuctionJoinOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="home-start auction-join-trigger"
                onClick={() => {
                  if (isAuctionJoinOpen) return
                  setAuctionError('')
                  setAuctionRoomDraft('')
                  setIsAuctionJoinOpen(true)
                }}
                disabled={auctionBusy}
              >
                방참가
              </button>
              <div className="auction-join-expanded">
                <input
                  className="auction-captain-input"
                  type="text"
                  value={auctionRoomDraft}
                  maxLength={10}
                  placeholder="코드 입력"
                  onChange={(e) => setAuctionRoomDraft(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    openAuctionRoom(false)
                  }}
                />
                <button type="button" className="tiny" onClick={() => openAuctionRoom(false)} disabled={auctionBusy}>
                  입장
                </button>
                <button
                  type="button"
                  className="tiny auction-join-cancel"
                  onClick={() => {
                    setIsAuctionJoinOpen(false)
                    setAuctionRoomDraft('')
                    setAuctionError('')
                  }}
                  disabled={auctionBusy}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (route === ROUTE.AUCTION) {
    return (
      <div className="app auction-page">
        {topMessage.text && <div className={`top-message ${topMessage.type}`}>{topMessage.text}</div>}
        <div className="page-tools auction-toolbar">
          <button type="button" className="ghost tiny" onClick={() => navigate(ROUTE.HOME)}>
            홈으로
          </button>
          <button type="button" className="ghost tiny" onClick={() => navigate(ROUTE.NORMAL)}>
            일반내전 이동
          </button>
          {isAuctionHost && (
            <label className="auction-seconds-control">
              경매시간(초)
              <input
                type="number"
                min={5}
                max={60}
                value={auctionSeconds}
                onChange={(e) => setAuctionSeconds(Math.min(60, Math.max(5, Number.parseInt(e.target.value || '10', 10))))}
              />
            </label>
          )}
          <span className="auction-mode-pill auction-room-code-pill">
            방코드 {auctionRoomCode || '-'}
            <span className="auction-room-copy-wrap">
              <button
                type="button"
                className="auction-room-copy-btn"
                onClick={copyAuctionRoomCode}
                disabled={!auctionRoomCode}
                aria-label="방코드 복사"
                title="방코드 복사"
              >
                <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
              </button>
              {isRoomCodeCopied && <span className="auction-copy-tooltip">복사 완료</span>}
            </span>
          </span>
          <span className="auction-mode-pill">{auctionConnected ? 'WS 연결됨' : 'WS 미연결'}</span>
          <span className="auction-mode-pill">{isAuctionHost ? '방장 모드' : '참가자 모드'}</span>
        </div>
        <section className="auction-layout">
          <div className="auction-team-stack">
            {auctionTeams.map((team) => (
              <article key={team.id} className="auction-team-card">
                <div className="auction-team-head">
                  <div className="auction-team-title-wrap">
                    <div className="auction-team-name-text">{team.name}</div>
                    {(team.captainName === '미참가' || team.id === auctionMyTeamId) && (
                      <button
                        type="button"
                        className="tiny auction-captain-join-btn"
                        disabled={!auctionRoomCode || auctionBusy || (team.id === auctionMyTeamId && (auctionRunning || auctionPaused))}
                        onClick={() => {
                          if (team.id === auctionMyTeamId) {
                            leaveCaptainTeam()
                            return
                          }
                          openCaptainJoinModal(team.id)
                        }}
                      >
                        {team.id === auctionMyTeamId ? '팀 탈퇴' : '주장참가'}
                      </button>
                    )}
                  </div>
                  <strong className="auction-points-badge">포인트 {team.points}</strong>
                </div>
                <div className="auction-team-roster">
                  {Array.from({ length: 5 }, (_, idx) => {
                    const rosterPlayers = [team.captainPlayer, ...team.players].filter(Boolean)
                    const player = rosterPlayers[idx]
                    return (
                      <div key={`${team.id}-slot-${idx}`} className="auction-roster-row">
                        {player ? (
                          <>
                            <div className="auction-roster-main">
                              <span className="auction-roster-name">{player.name}</span>
                              {idx === 0 && <span className="auction-captain-badge">주장</span>}
                              {player.tier && (
                                <span className={`tier-pill ${getTierClass(player.tier)}`}>
                                  {getTierLabel(player.tier, (player.name || '').length >= 10)}
                                </span>
                              )}
                            </div>
                            <div className="auction-roster-pos">
                              {player.positions.length > 0 ? player.positions.join(' / ') : '라인 미지정'}
                            </div>
                          </>
                        ) : (
                          <span className="auction-slot-empty">{idx === 0 ? '주장 슬롯' : '빈 슬롯'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>

          <div className="auction-center-stage">
            <div className="auction-center-main">
              <div className="auction-current-player">
              {isAuctionHost && isAuctionCenterUnlocked && (
                <button
                  type="button"
                  className="auction-undo-btn"
                  onClick={undoAuctionCurrent}
                  disabled={auctionBusy || !auctionSessionToken || !auctionCanUndo}
                >
                  되돌리기
                </button>
              )}
              {auctionCurrent ? (
                <div className="auction-current-card">
                  <div className={`auction-current-tier-icon ${getTierClass(auctionCurrent.tier || '')}`}>
                    {getTierIcon(auctionCurrent.tier)}
                  </div>
                  <h3>{auctionCurrent.name}</h3>
                  <p>{auctionCurrent.tier || '티어 미지정'}</p>
                  <p>{auctionCurrent.positions.length > 0 ? auctionCurrent.positions.join(' / ') : '라인 미지정'}</p>
                  <div className="auction-timer">{auctionTimeLeft}s</div>
                </div>
              ) : (
                <div className="auction-current-card">
                  {isAuctionFinished ? (
                    <>
                      <h3>경매 종료</h3>
                      <p>모든 경매가 종료되었습니다.</p>
                    </>
                  ) : (
                    <>
                      <h3>대기 중</h3>
                      <p>경매 시작을 눌러 진행을 시작하세요.</p>
                    </>
                  )}
                </div>
              )}
              </div>

              <div className="auction-round-timer">
                <div className="auction-round-timer-head">
                  <strong>경매 시간 제한</strong>
                  <span>{auctionRunning || auctionPaused ? `${auctionTimeLeft}s` : `${auctionSeconds}s`}</span>
                </div>
                <div className="auction-round-track">
                  <div
                    className="auction-round-fill"
                    style={{
                      width: auctionRunning || auctionPaused
                        ? `${Math.max(0, Math.min(100, (auctionTimeLeft / auctionSeconds) * 100))}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>

              <div className="auction-next-player">
                <div className="auction-next-player-head">다음 경매 플레이어</div>
                {auctionQueue.length === 0 ? (
                  <div className="auction-empty">대기 명단 없음</div>
                ) : (
                  <div className="auction-next-player-main">
                    <strong>{auctionQueue[0].name}</strong>
                    <span>
                      {auctionQueue[0].tier || '티어 미지정'} | {auctionQueue[0].positions.length > 0 ? auctionQueue[0].positions.join(' / ') : '라인 미지정'}
                    </span>
                  </div>
                )}
              </div>

              <div className="auction-single-bid">
                <div className="auction-next-player-head">입찰</div>
                <div className="auction-single-bid-row">
                  <div className="auction-my-team-label">
                    {myTeam ? `${myTeam.name} ${myTeam.captainName}` : '내 팀 미지정 (주장참가 필요)'}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={auctionBidAmount}
                    placeholder="입찰 P"
                    onChange={(e) => setAuctionBidAmount(e.target.value)}
                    disabled={!auctionRunning || !auctionSessionToken || !myTeam}
                  />
                  <button
                    type="button"
                    className="tiny"
                    disabled={!auctionRunning || !myTeam || !auctionSessionToken}
                    onClick={() => submitAuctionBid(auctionMyTeamId, auctionBidAmount)}
                  >
                    입찰 등록
                  </button>
                </div>
              </div>

              <div className="auction-log-panel">
                <h4>경매 진행상황</h4>
                <div className="auction-log-list">
                  {auctionLogs.length === 0 ? (
                    <div className="auction-empty">진행 로그 없음</div>
                  ) : (
                    auctionLogs.map((line, index) => (
                      <div key={`auction-log-${index}`} className="auction-log-line">{line}</div>
                    ))
                  )}
                </div>
              </div>

              {!isAuctionCenterUnlocked && (
                <div className="auction-main-mask">
                  {isAuctionHost ? (
                    <button
                      type="button"
                      className="auction-main-start-btn"
                      onClick={drawAuctionPlayer}
                      disabled={auctionBusy || auctionRunning || !auctionSessionToken}
                    >
                      경매 시작
                    </button>
                  ) : (
                    <div className="auction-main-waiting-text">방장이 경매 시작을 누르면 진행됩니다.</div>
                  )}
                </div>
              )}
            </div>

            <div className="auction-center-actions">
              <button type="button" className="tiny auction-action-roster-btn" onClick={() => setIsAuctionRosterOpen(true)} disabled={!isAuctionHost}>
                경매 명단 추가
              </button>
              <button
                type="button"
                className="tiny auction-pause-btn"
                onClick={togglePauseAuctionRound}
                disabled={!isAuctionHost || !auctionSessionToken || (!auctionRunning && !auctionPaused)}
              >
                {auctionPaused ? '재개' : '일시 정지'}
              </button>
              <button
                type="button"
                className="tiny auction-action-restart-btn"
                onClick={restartAuctionRound}
                disabled={!isAuctionHost || !auctionSessionToken || !isAuctionCenterUnlocked}
              >
                경매 재시작
              </button>
              <button
                type="button"
                className="tiny auction-action-finish-btn"
                onClick={finishAuctionRound}
                disabled={!isAuctionHost || !auctionRunning || !auctionSessionToken}
              >
                라운드 종료
              </button>
              <div className="auction-waiting-count">대기 선수 {auctionQueue.length}명</div>
            </div>
          </div>

          <aside className="auction-order-panel">
            <div className="auction-order-section">
              <div className="auction-order-head">경매순서</div>
              <div className="auction-order-grid">
                {auctionQueue.length === 0 ? (
                  <div className="auction-empty">대기 명단 없음</div>
                ) : (
                  auctionQueue.map((player) => (
                    <div key={`queue-${player.id}`} className="auction-order-item">
                      <strong>{player.name}</strong>
                      <span>{player.tier || '미지정'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="auction-order-section">
              <div className="auction-order-head auction-order-head-sub">유찰/낙찰 선수</div>
              <div className="auction-order-grid">
                {auctionSoldPlayers.length === 0 ? (
                  <div className="auction-empty">아직 낙찰 선수 없음</div>
                ) : (
                  auctionSoldPlayers.map((player) => (
                    <div key={`sold-${player.id}`} className="auction-order-item sold">
                      <strong>{player.name}</strong>
                      <span>{player.tier || '미지정'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>

        {isAuctionRosterOpen && isAuctionHost && (
          <div className="modal-backdrop" onMouseDown={() => setIsAuctionRosterOpen(false)}>
            <div className="help-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <div className="help-modal-header">
                <h3>경매 명단 입력</h3>
                <button type="button" className="ghost" onClick={() => setIsAuctionRosterOpen(false)}>닫기</button>
              </div>
              <section className="modal-note">
                <p>일반내전과 동일하게 복사/붙여넣기 후 `명단 추가`를 누르세요.</p>
              </section>
              <textarea
                placeholder={'예) 닉네임#태그 / 티어 / 라인,라인'}
                value={auctionInput}
                onChange={(e) => setAuctionInput(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (event.shiftKey || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  loadAuctionPlayersFromInput()
                }}
                rows={4}
              />
              <div className="input-actions">
                <button type="button" onClick={loadAuctionPlayersFromInput} disabled={auctionBusy || !auctionSessionToken}>명단 추가</button>
                <button type="button" className="ghost" onClick={() => setAuctionInput('')}>입력 비우기</button>
              </div>
            </div>
          </div>
        )}

        {isCaptainJoinOpen && (
          <div className="modal-backdrop" onMouseDown={() => setIsCaptainJoinOpen(false)}>
            <div className="help-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <div className="help-modal-header">
                <h3>주장 참가</h3>
                <button type="button" className="ghost" onClick={() => setIsCaptainJoinOpen(false)}>닫기</button>
              </div>
              <section className="modal-note">
                <p>주장 닉네임을 입력하면 해당 팀 1번 슬롯(주장 슬롯)에 배치됩니다.</p>
                <p>입력 예시: `닉네임#태그 / 티어 / 라인`</p>
              </section>
              <textarea
                placeholder={'예) 닉네임#태그 / 티어 / 라인,라인'}
                value={captainJoinDraft}
                onChange={(e) => setCaptainJoinDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (event.shiftKey || event.nativeEvent.isComposing) return
                  event.preventDefault()
                  joinCaptainToTeam()
                }}
                rows={3}
              />
              <div className="input-actions">
                <button type="button" onClick={joinCaptainToTeam} disabled={auctionBusy}>주장참가 적용</button>
                <button type="button" className="ghost" onClick={() => setCaptainJoinDraft('')}>입력 비우기</button>
              </div>
            </div>
          </div>
        )}

        {isCaptainJoinBlockedOpen && (
          <div className="modal-backdrop" onMouseDown={() => setIsCaptainJoinBlockedOpen(false)}>
            <div className="help-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <div className="help-modal-header">
                <h3>안내</h3>
                <button type="button" className="ghost" onClick={() => setIsCaptainJoinBlockedOpen(false)}>닫기</button>
              </div>
              <section className="modal-note">
                <p>현재팀에 가입되어있습니다.</p>
              </section>
              <div className="input-actions">
                <button type="button" onClick={() => setIsCaptainJoinBlockedOpen(false)}>확인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      {topMessage.text && <div className={`top-message ${topMessage.type}`}>{topMessage.text}</div>}
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
        <div className="modal-backdrop" onMouseDown={() => setIsPoolModalOpen(false)}>
          <div className="pool-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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
                    <span className={`tier-pill ${getTierClass(section.tier)}`}>{getTierLabel(section.tier)}</span>
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
        <div className="modal-backdrop" onMouseDown={() => setIsHelpModalOpen(false)}>
          <div className="help-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>사용방법</h3>
              <button type="button" className="ghost" onClick={() => setIsHelpModalOpen(false)}>닫기</button>
            </div>

            <section className="modal-note">
              <h4>1. 명단 입력</h4>
              <p>`닉네임#태그 / 티어 / 라인` 형식으로 입력하거나 채팅 내용을 그대로 붙여넣으세요.</p>
              <p>예시: `선수#KR1 / 다이아 / 탑 미드`</p>
            </section>

            <section className="modal-note">
              <h4>2. 팀 배정</h4>
              <p>대기 목록의 선수를 팀 A 또는 팀 B 컬럼으로 드래그해서 배정합니다.</p>
              <p>선수 카드 우측 상단 `삭제` 버튼으로 즉시 제거할 수 있습니다.</p>
            </section>

            <section className="modal-note">
              <h4>3. 빠른 조작</h4>
              <p>`Ctrl+클릭`(Mac은 `Cmd+클릭`)으로 다중 선택 후 한 번에 이동할 수 있습니다.</p>
              <p>가운데 `교체` 버튼으로 팀 A/B 전체를 서로 바꿀 수 있습니다.</p>
            </section>

            <section className="modal-note">
              <h4>4. 팝업 배정</h4>
              <p>대기 컬럼의 `팝업` 버튼을 누르면 티어별 목록이 열립니다.</p>
              <p>팝업에서 A/B 버튼으로 드래그 없이 바로 배정할 수 있습니다.</p>
            </section>

            <section className="modal-note">
              <h4>5. 캡처 복사</h4>
              <p>카메라 버튼을 누르면 팀 A/B 영역 이미지를 클립보드에 복사합니다.</p>
              <p>브라우저 권한 정책에 따라 복사가 제한될 수 있습니다.</p>
            </section>

            <section className="modal-note">
              <h4>6. 초기화 버튼 차이</h4>
              <p>`전체초기화`: 현재 등록된 모든 선수를 완전히 삭제합니다.</p>
              <p>`팀초기화`: 선수는 유지하고, 팀 A/B 인원만 모두 대기로 되돌립니다.</p>
            </section>
          </div>
        </div>
      )}

      {isUpdateModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setIsUpdateModalOpen(false)}>
          <div className="help-modal" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <div className="help-modal-header">
              <h3>업데이트 내역</h3>
              <button type="button" className="ghost" onClick={() => setIsUpdateModalOpen(false)}>닫기</button>
            </div>

            {CHANGELOG_ENTRIES.map((entry) => (
              <section key={entry.date} className="modal-note update-block">
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
