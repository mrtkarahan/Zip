(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var board = $('board'), U = 100;
  var size = 5, mode = 'random', puzzle, path = [], startTime = 0, tick = null, won = false, dragging = false;

  var key = function (r, c) { return r + ',' + c; };
  var ctr = function (p) { return (p[1] * U + U / 2) + ',' + (p[0] * U + U / 2); };
  var store = function (fn) { try { return fn(localStorage); } catch (e) { return null; } };
  var bestKey = function () { return 'patika.best.' + mode + '.' + size; };
  var fmt = function (s) { return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2); };
  var buzz = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
  var each = function (sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); };

  function seedFor() {
    if (mode === 'daily') { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
    return Math.floor(Math.random() * 2147483646) + 1;
  }

  function newGame() {
    puzzle = PatikaGen.generate(size, seedFor());
    clearPath(); $('win').hidden = true;
  }

  function clearPath() {
    path = []; won = false; startTime = 0; clearInterval(tick); tick = null;
    $('timer').textContent = '0:00'; $('msg').textContent = ''; render();
  }

  function render() {
    var n = puzzle.size, s = '', r, c;
    board.setAttribute('viewBox', '0 0 ' + n * U + ' ' + n * U);
    var inPath = {};
    path.forEach(function (p) { inPath[key(p[0], p[1])] = 1; });
    for (r = 0; r < n; r++) for (c = 0; c < n; c++)
      s += '<rect x="' + c * U + '" y="' + r * U + '" width="' + U + '" height="' + U + '" fill="' + (inPath[key(r, c)] ? 'var(--fill)' : 'var(--cell)') + '" stroke="var(--grid)" stroke-width="1"/>';
    if (path.length > 1) s += '<polyline points="' + path.map(ctr).join(' ') + '" fill="none" stroke="var(--path)" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>';
    puzzle.walls.forEach(function (w) {
      var p = w.split('|').map(function (x) { return x.split(',').map(Number); }), a = p[0], b = p[1], x1, y1, x2, y2;
      if (a[0] === b[0]) { x1 = x2 = b[1] * U; y1 = a[0] * U; y2 = y1 + U; } // same row: vertical wall line
      else { y1 = y2 = b[0] * U; x1 = a[1] * U; x2 = x1 + U; }
      s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="var(--wall)" stroke-width="8" stroke-linecap="round"/>';
    });
    for (var k in puzzle.numbers) {
      var q = k.split(','), cx = q[1] * U + U / 2, cy = q[0] * U + U / 2;
      s += '<circle cx="' + cx + '" cy="' + cy + '" r="26" fill="var(--num)"/><text x="' + cx + '" y="' + cy + '" fill="var(--numfg)" font-size="30" font-weight="700" text-anchor="middle" dominant-baseline="central">' + puzzle.numbers[k] + '</text>';
    }
    s += '<rect x="2" y="2" width="' + (n * U - 4) + '" height="' + (n * U - 4) + '" fill="none" stroke="var(--wall)" stroke-width="8" rx="10"/>';
    board.innerHTML = s;
  }

  function cellAt(e) {
    var b = board.getBoundingClientRect(), n = puzzle.size;
    var c = Math.floor((e.clientX - b.left) / b.width * n), r = Math.floor((e.clientY - b.top) / b.height * n);
    return (r < 0 || c < 0 || r >= n || c >= n) ? null : [r, c];
  }

  function idxInPath(p) {
    for (var i = 0; i < path.length; i++) if (path[i][0] === p[0] && path[i][1] === p[1]) return i;
    return -1;
  }

  // Try one step onto adjacent cell t (or undo if t is the previous cell); true if path changed.
  function step(t) {
    var last = path[path.length - 1], prev = path[path.length - 2];
    if (prev && t[0] === prev[0] && t[1] === prev[1]) { path.pop(); return true; }
    if (idxInPath(t) >= 0 || !PatikaGen.canMove(puzzle, last, t)) return false;
    var num = puzzle.numbers[key(t[0], t[1])];
    if (num) { // numbered cells must be entered in order
      var seen = path.filter(function (p) { return puzzle.numbers[key(p[0], p[1])]; }).length;
      if (num !== seen + 1) return false;
    }
    path.push(t); return true;
  }

  // Fast drags: walk toward the target one cell at a time (dominant axis first), stop when blocked.
  function moveTo(t) {
    var changed = false, guard = 0;
    while (guard++ < 20) {
      var l = path[path.length - 1], dr = t[0] - l[0], dc = t[1] - l[1];
      if (!dr && !dc) break;
      var nx = Math.abs(dr) >= Math.abs(dc) ? [l[0] + Math.sign(dr), l[1]] : [l[0], l[1] + Math.sign(dc)];
      if (!step(nx)) break;
      changed = true;
    }
    if (changed) { buzz(); afterChange(); }
  }

  function afterChange() {
    if (!startTime && path.length > 1) {
      startTime = Date.now();
      tick = setInterval(function () { $('timer').textContent = fmt((Date.now() - startTime) / 1000); }, 250);
    }
    render(); check();
  }

  function check() {
    $('msg').textContent = '';
    if (path.length !== puzzle.size * puzzle.size) return;
    var v = PatikaGen.validate(puzzle, path);
    if (v.complete) return win();
    $('msg').textContent = v.error || '';
  }

  function win() {
    won = true; clearInterval(tick);
    var t = Math.round((Date.now() - startTime) / 1000);
    var best = store(function (s) { return Number(s.getItem(bestKey())) || 0; });
    if (!best || t < best) { best = t; store(function (s) { s.setItem(bestKey(), t); }); }
    $('win-time').textContent = 'Süre: ' + fmt(t);
    $('win-best').textContent = 'En iyi: ' + fmt(best);
    $('win').hidden = false;
  }

  board.addEventListener('pointerdown', function (e) {
    if (won) return;
    var t = cellAt(e); if (!t) return;
    var i = idxInPath(t);
    if (i >= 0) path.length = i + 1;                       // tap on path: truncate there
    else if (!path.length && puzzle.numbers[key(t[0], t[1])] === 1) path = [t];
    else return;
    dragging = true; board.setPointerCapture(e.pointerId); e.preventDefault();
    afterChange();
  });
  board.addEventListener('pointermove', function (e) {
    if (!dragging || won) return;
    var t = cellAt(e); if (t && path.length) moveTo(t);
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) { board.addEventListener(ev, function () { dragging = false; }); });

  $('undo').onclick = function () { if (!won && path.length) { path.pop(); afterChange(); } };
  $('clear').onclick = clearPath;
  $('new').onclick = $('win-new').onclick = newGame;
  $('win-close').onclick = function () { $('win').hidden = true; };
  $('hint').onclick = function () {
    if (won) return;
    var p = 0, sol = puzzle.solution;
    while (p < path.length && p < sol.length && path[p][0] === sol[p][0] && path[p][1] === sol[p][1]) p++;
    path = sol.slice(0, Math.min(p + 1, sol.length)).map(function (x) { return x.slice(); });
    afterChange();
  };

  function sync() {
    each('[data-size]', function (b) { b.classList.toggle('on', +b.dataset.size === size); });
    each('[data-mode]', function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
  }
  each('[data-size]', function (b) { b.onclick = function () { size = +b.dataset.size; sync(); newGame(); }; });
  each('[data-mode]', function (b) { b.onclick = function () { mode = b.dataset.mode; sync(); newGame(); }; });

  sync(); newGame();
})();
