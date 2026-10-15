import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { getView, poem, verses, type ViewId } from './poem';
import type { WorldController, WorldStatus } from './world';

function Icon({ name }: { name: 'leaf' | 'compass' | 'pause' | 'play' | 'expand' | 'close' | 'arrow' | 'mountain' }) {
  const paths = {
    leaf: <path d="m12 2 1.8 5 4.7-2-.8 5 4.3 1.8-6 3.9-3 .8V22h-2v-5.5l-3-.8-6-3.9L6.3 10l-.8-5 4.7 2Z" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 5 11 7-11 7Z" />,
    expand: <path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
    mountain: <path d="m2 19 7-12 4 6 3-4 6 10ZM7 11l2 2 2-2" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill={name === 'leaf' ? 'currentColor' : 'none'} stroke={name === 'leaf' ? 'none' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<WorldController | null>(null);
  const [selected, setSelected] = useState<ViewId>('overview');
  const [status, setStatus] = useState<WorldStatus>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [reduced, setReduced] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [manual, setManual] = useState(false);
  const reducedMotion = systemReduced || reduced;
  const stateRef = useRef({ selected, paused, reducedMotion });
  stateRef.current = { selected, paused, reducedMotion };
  const view = getView(selected);
  const index = verses.findIndex((verse) => verse.id === selected);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setSystemReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let active = true;
    let instance: WorldController | undefined;
    setStatus('loading');
    setError('');
    setManual(false);
    void import('./world').then(({ createWorld }) => {
      if (!active || !host.current) return;
      instance = createWorld(host.current, {
        paused: stateRef.current.paused,
        reduced: stateRef.current.reducedMotion,
        onStatus: (next, message) => {
          if (!active) return;
          setStatus(next);
          setError(message ?? '');
        },
        onManual: () => { if (active) setManual(true); },
      });
      controller.current = instance;
      if (stateRef.current.selected !== 'overview') instance.select(stateRef.current.selected);
    }).catch(() => {
      if (!active) return;
      setStatus('error');
      setError('当前浏览器暂时无法呈现三维山景。诗文仍可阅读，你也可以尝试重新进入。');
    });
    return () => {
      active = false;
      instance?.dispose();
      if (controller.current === instance) controller.current = null;
    };
  }, [retry]);

  useEffect(() => {
    controller.current?.setMotion(paused, reducedMotion);
  }, [paused, reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImmersive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function select(id: ViewId) {
    setSelected(id);
    setManual(false);
    controller.current?.select(id);
  }

  const next = () => select(verses[(index + 1) % verses.length].id);

  function navigateVerses(event: ReactKeyboardEvent<HTMLElement>) {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.verse'));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let nextIndex: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (current + 1) % buttons.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (current + buttons.length - 1) % buttons.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[nextIndex].focus();
    select(verses[nextIndex].id);
  }

  return (
    <div className={`app${immersive ? ' is-immersive' : ''}`}>
      <header className="masthead">
        <a className="brand" href="./" aria-label="诗境首页"><Icon name="leaf" /><span>诗境</span><span className="brand-en">WORLDS IN POETRY</span></a>
        <div className="edition"><span className="edition-line" />一首诗，一次旅行。</div>
        <div className="season"><span />深秋 · 日暮</div>
      </header>

      <main className="experience" id="main">
        <section className="stage" aria-label="山行诗境">
          <div className="world-host" ref={host} />
          <div className="stage-vignette" aria-hidden="true" />
          <div className="scene-heading">
            <span className="eyebrow">{view.english}</span>
            <h2>{view.label}</h2>
            <span className="scene-location">{selected === 'overview' ? '山行 · 全景' : `山行 · 第${['一', '二', '三', '四'][index]}景`}{manual ? ' / 自由环顾' : ''}</span>
          </div>
          <div className="scene-tools">
            <button className="tool" onClick={() => select('overview')} disabled={status !== 'ready'} aria-label="返回全景" title="返回全景"><Icon name="compass" /><span>全景</span></button>
            <span className="tool-divider" />
            <button className="tool icon-tool" onClick={() => setPaused(!paused)} disabled={status !== 'ready'} aria-label={paused ? '继续动画' : '暂停动画'} aria-pressed={paused} title={paused ? '继续动画' : '暂停动画'}><Icon name={paused ? 'play' : 'pause'} /></button>
            <button className="tool icon-tool" onClick={() => setImmersive(!immersive)} aria-label={immersive ? '退出沉浸' : '进入沉浸'} aria-pressed={immersive} title={immersive ? '退出沉浸（Esc）' : '进入沉浸'}><Icon name={immersive ? 'close' : 'expand'} /></button>
          </div>
          {status === 'loading' && <div className="scene-message loading" role="status"><Icon name="mountain" /><span>山色正在铺开</span><span className="message-caption">片刻之后，循诗入山。</span></div>}
          {status === 'error' && <div className="scene-message error" role="alert"><Icon name="mountain" /><h2>山林暂时隐入云中</h2><p>{error}</p><button className="retry-button" onClick={() => setRetry((value) => value + 1)}>重新进入山林 <Icon name="arrow" /></button></div>}
          <div className="scene-bottom">
            <p className="scene-hint"><span className="desktop-hint">拖动环顾 · 滚轮缩放</span><span className="mobile-hint">单指环顾 · 双指缩放</span></p>
            <div className="scene-counter"><span>{selected === 'overview' ? '00' : `0${index + 1}`}</span><i />04</div>
          </div>
          {immersive && <div className="immersive-verses" aria-label="沉浸模式诗句导航">{verses.map((verse, i) => <button key={verse.id} onClick={() => select(verse.id)} aria-label={verse.text} aria-pressed={selected === verse.id}>{`0${i + 1}`}<span>{verse.text}</span></button>)}</div>}
        </section>

        <aside className="poem-panel" aria-label="诗文与导览" hidden={immersive}>
          <div className="poem-title">
            <span className="eyebrow">A WALK IN THE MOUNTAINS</span>
            <div className="title-row"><h1>{poem.title}</h1><span className="seal" aria-hidden="true">秋<br />山</span></div>
            <p className="author">{poem.dynasty} <span>／</span> {poem.author}</p>
            <p className="invitation">沿着石径，走进秋天。</p>
          </div>

          <nav className="poem-nav" aria-label="逐句游览" onKeyDown={navigateVerses}>
            {verses.map((verse, i) => (
              <button key={verse.id} className={`verse${selected === verse.id ? ' is-selected' : ''}`} data-view={verse.id} onClick={() => select(verse.id)} aria-pressed={selected === verse.id}>
                <span className="verse-number">0{i + 1}</span>
                <span className="verse-content"><span className="verse-text">{verse.text}</span><span className="verse-caption">{verse.label}</span></span>
                <span className="verse-indicator" aria-hidden="true"><Icon name="arrow" /></span>
              </button>
            ))}
          </nav>

          <div className="reading-note" aria-live="polite" aria-atomic="true">
            <span className="note-label">{selected === 'overview' ? '此行小记' : `${String(index + 1).padStart(2, '0')} / ${view.label}`}</span>
            <p>{view.description}</p>
          </div>
          <button className="journey-button" onClick={next} disabled={status === 'loading'}>{index === -1 ? '循诗入山' : index === 3 ? '再走一遍' : '走向下一句'}<Icon name="arrow" /></button>
          <div className="panel-end">
            <label className="motion-option"><input type="checkbox" checked={reducedMotion} disabled={systemReduced} onChange={(event) => setReduced(event.target.checked)} /><span>{systemReduced ? '已跟随系统减少动态' : '简化动态'}</span></label>
            <details className="source-note"><summary>原文与意象</summary><p>{poem.source.variant}</p><p>木车、马匹与旅人是视觉补充；山居造型为意象表达。此处未指认具体山址。</p><a href={poem.source.url} target="_blank" rel="noreferrer">{poem.source.label} ↗</a></details>
          </div>
        </aside>
      </main>

      <footer className="footer"><span><Icon name="leaf" />把片刻，留给山色。</span><span>山行 <i>·</i> 杜牧 <i>·</i> 七言绝句</span></footer>
    </div>
  );
}
