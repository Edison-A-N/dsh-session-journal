/** One style tag for the journal tab and header chip (deduped across HMR reloads). */
const CSS = `
.dsj-root{height:100%;overflow-y:auto;scrollbar-gutter:stable;padding:12px 14px 8px;box-sizing:border-box;font-size:13px;line-height:20px;
  color:var(--dsw-alias-label-primary,#222)}
.dsj-root *{box-sizing:border-box}
.dsj-root button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}
.dsj-root p{margin:0}
.dsj-empty{color:var(--dsw-alias-label-tertiary,#999);padding:24px 0;text-align:center}
.dsj-dim{color:var(--dsw-alias-label-tertiary,#999)}
.dsj-push{margin-left:auto}
.dsj-add{color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-del{color:var(--dsw-alias-state-error-primary,#d9363e)}
[data-tone=bad]{color:var(--dsw-alias-state-error-primary,#d9363e)}
[data-tone=good]{color:var(--dsw-alias-state-success-primary,#2a9d55)}
[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d97706)}

.dsj-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary,#aaa)}
.dsj-dot[data-running]{background:var(--dsw-alias-state-success-primary,#2a9d55);animation:dsj-pulse 1.4s ease-in-out infinite}
@keyframes dsj-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* Now */
.dsj-now-card{padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e5e5e5);display:flex;flex-direction:column;gap:6px}
.dsj-now-line{display:flex;align-items:center;gap:8px;font-weight:600}
.dsj-now-state{font-weight:600}
.dsj-now-phase{padding:0 7px;border-radius:9px;font-size:12px;line-height:18px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.dsj-now-line .dsj-dim{font-weight:400;font-size:12px;font-variant-numeric:tabular-nums}
.dsj-now-text{color:var(--dsw-alias-label-primary,#222)}
.dsj-waiting{padding:6px 8px;border-radius:8px;background:rgba(217,119,6,.10);color:var(--dsw-alias-label-primary,#222)}
.dsj-waiting-tag{display:inline-block;margin-right:6px;padding:0 6px;border-radius:4px;font-size:11px;line-height:18px;font-weight:600;
  color:#fff;background:var(--dsw-alias-state-warning-primary,#d97706)}
.dsj-stats{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;color:var(--dsw-alias-label-secondary,#555)}

.dsj-section{padding:14px 0 4px}
.dsj-h{margin:0 0 8px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#555);display:flex;align-items:center;gap:8px}
.dsj-h .dsj-dim{font-weight:400}
.dsj-h4{margin:0 0 2px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#555)}
.dsj-h4[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d97706)}

/* Work items */
.dsj-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.dsj-item{border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e5e5e5);padding:8px 10px}
.dsj-item[data-status=active]{border-color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-item[data-status=blocked]{border-color:var(--dsw-alias-state-warning-primary,#d97706)}
.dsj-item[data-status=dropped]{opacity:.6}
.dsj-item-head{display:flex;align-items:center;gap:8px;width:100%}
.dsj-item-title{flex:1;min-width:0;font-weight:600;font-size:14px;overflow:hidden;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.dsj-item[data-open] .dsj-item-title{-webkit-line-clamp:4}
.dsj-caret{flex:none;color:var(--dsw-alias-label-tertiary,#999);font-size:11px}
.dsj-badge{flex:none;padding:0 6px;border-radius:4px;font-size:11px;line-height:18px;font-weight:600;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#555)}
.dsj-badge[data-tone=active]{color:#fff;background:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-badge[data-tone=warn]{color:#fff;background:var(--dsw-alias-state-warning-primary,#d97706)}
.dsj-badge[data-tone=good]{color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-badge[data-tone=warn-soft]{color:var(--dsw-alias-state-warning-primary,#d97706);background:rgba(217,119,6,.12)}
.dsj-item[data-status=done][data-unresolved]{border-color:rgba(217,119,6,.55)}
.dsj-item-counts{display:flex;gap:6px;margin-top:6px}
.dsj-count{padding:0 8px;border-radius:10px;font-size:12px;line-height:20px;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05));color:var(--dsw-alias-label-tertiary,#999)}
.dsj-count b{font-weight:700;font-variant-numeric:tabular-nums}
.dsj-count[data-tone=warn]{color:var(--dsw-alias-state-warning-primary,#d97706);background:rgba(217,119,6,.12)}
.dsj-count[data-tone=info]{color:var(--dsw-alias-label-primary,#222)}
.dsj-item-sub{display:flex;flex-wrap:wrap;gap:2px 10px;margin-top:2px;font-size:12px;color:var(--dsw-alias-label-secondary,#555)}
.dsj-item-body{margin-top:8px;display:flex;flex-direction:column;gap:8px}
.dsj-item-goal{color:var(--dsw-alias-label-secondary,#555);font-size:12px}
.dsj-item-result{}
.dsj-bullets{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dsj-bullets li{position:relative;padding-left:12px}
.dsj-bullets li::before{content:'';position:absolute;left:2px;top:9px;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.45}
.dsj-chip{display:inline-block;padding:0 6px;margin-right:6px;border-radius:4px;font-size:11px;line-height:18px;
  background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-secondary,#555)}

.dsj-tabs{display:flex;flex-wrap:wrap;gap:6px}
.dsj-root .dsj-tabs button{max-width:100%;padding:1px 8px;border-radius:6px;font-size:12px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-secondary,#555);border:1px solid var(--dsw-alias-border-l2,#e0e0e0)}
.dsj-root .dsj-tabs button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-root .dsj-tabs button[data-on]{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.07));color:var(--dsw-alias-label-primary,#222)}

/* Turn index inside an item: one clickable row per turn, jumps to the chat */
.dsj-turns{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.dsj-turn-wrap{display:block}
.dsj-root .dsj-turn{display:flex;align-items:baseline;gap:8px;width:100%;padding:4px 8px;border-radius:6px;font-size:12px;line-height:18px;cursor:pointer}
.dsj-root .dsj-turn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-root .dsj-turn:hover .dsj-turn-no{text-decoration:underline}
.dsj-turn-no{flex:none;font-weight:600;color:var(--dsw-alias-state-info-primary,#2f6fed)}
.dsj-turn-ask{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#222)}
.dsj-turn-ask[data-derived]{color:var(--dsw-alias-label-tertiary,#999);font-style:italic}
.dsj-turn-meta{flex:none;display:inline-flex;align-items:baseline;gap:6px;font-variant-numeric:tabular-nums}
.dsj-turn-meta .dsj-phase-name{font-weight:400;color:var(--dsw-alias-label-secondary,#555)}
.dsj-turn-meta .dsj-phase-name[data-kind=review]{color:#8a5cf5}
.dsj-turn-meta .dsj-phase-name[data-kind=fix]{color:#d97706}
.dsj-turn-meta .dsj-phase-name[data-kind=test]{color:#0e9f8e}
.dsj-turn-meta .dsj-phase-name[data-kind=implement]{color:#2f6fed}
.dsj-turn-meta .dsj-phase-name[data-kind=debug]{color:#d9363e}

/* Phases inside an item */
.dsj-timeline{list-style:none;margin:0;padding:0}
.dsj-phase{position:relative;padding:0 0 6px 16px}
.dsj-phase::before{content:'';position:absolute;left:4px;top:16px;bottom:0;width:1px;background:var(--dsw-alias-border-l2,#e5e5e5)}
.dsj-phase:last-child::before{display:none}
.dsj-phase-head{display:flex;align-items:baseline;gap:6px;font-size:12px}
.dsj-marker{position:absolute;left:0;width:9px;text-align:center;font-size:11px;color:var(--dsw-alias-label-tertiary,#aaa)}
.dsj-phase[data-active] .dsj-marker{color:var(--dsw-alias-state-success-primary,#2a9d55)}
.dsj-phase-name{font-weight:600;white-space:nowrap}
.dsj-phase-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#555)}
.dsj-phase-time{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary,#999);font-variant-numeric:tabular-nums}
.dsj-phase-text{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#555)}
.dsj-phase[data-kind=review] .dsj-phase-name,.dsj-chipbtn[data-kind=review]{color:#8a5cf5}
.dsj-phase[data-kind=fix] .dsj-phase-name,.dsj-chipbtn[data-kind=fix]{color:#d97706}
.dsj-phase[data-kind=test] .dsj-phase-name,.dsj-chipbtn[data-kind=test]{color:#0e9f8e}
.dsj-phase[data-kind=implement] .dsj-phase-name,.dsj-chipbtn[data-kind=implement]{color:#2f6fed}
.dsj-phase[data-kind=debug] .dsj-phase-name,.dsj-chipbtn[data-kind=debug]{color:#d9363e}

/* Files inside an item */
.dsj-files{list-style:none;margin:0;padding:0}
.dsj-file{display:flex;align-items:baseline;gap:8px;width:100%;padding:2px 6px;margin:0 -6px;border-radius:6px;font-size:12px}
.dsj-file:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-root .dsj-file:disabled{cursor:default;opacity:.65}
.dsj-file-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Menlo,monospace)}
.dsj-file-dir{margin-left:6px;color:var(--dsw-alias-label-tertiary,#999)}
.dsj-new{flex:none;padding:0 4px;border-radius:4px;font-size:10px;line-height:16px;
  color:var(--dsw-alias-state-success-primary,#2a9d55);border:1px solid currentColor}
.dsj-file-delta{flex:none;font-variant-numeric:tabular-nums}
.dsj-file-phases{flex:none;color:var(--dsw-alias-label-tertiary,#999)}

.dsj-footer{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2,#e5e5e5);
  font-size:12px;color:var(--dsw-alias-label-tertiary,#999)}
.dsj-footer-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsj-lang{flex:none;display:inline-flex;align-items:center;gap:4px}
.dsj-lang select{font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,#555);background:transparent;
  border:1px solid var(--dsw-alias-border-l2,#e0e0e0);border-radius:6px;padding:1px 4px;cursor:pointer}
.dsj-lang select option{color:var(--dsw-alias-label-primary,#222);background:var(--dsw-alias-bg-overlay,#fff)}
.dsj-refresh{flex:none;width:22px;height:22px;border-radius:6px;text-align:center!important}
.dsj-refresh:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}

.dsj-chipbtn{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:12px;font-size:12px;font-weight:600;
  white-space:nowrap;border:1px solid var(--dsw-alias-border-l2,#e0e0e0);background:transparent;cursor:pointer;
  color:var(--dsw-alias-label-secondary,#555)}
.dsj-chipbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsj-chipbtn[data-waiting]{color:var(--dsw-alias-state-warning-primary,#d97706);border-color:currentColor}
@media (prefers-reduced-motion:reduce){.dsj-dot{animation:none!important}}
`

export function injectStyles() {
  const id = 'dsh-session-journal-styles'
  let tag = document.getElementById(id)
  if (tag === null) {
    tag = document.createElement('style')
    tag.id = id
    document.head.appendChild(tag)
  }
  tag.textContent = CSS
}
