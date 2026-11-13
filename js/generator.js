/* Patika puzzle generator: seeded Hamiltonian path + waypoints/walls, uniqueness via backtracking solver. */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wallKey(a, b) {
    var i = a[0] * 1000 + a[1], j = b[0] * 1000 + b[1];
    return i < j ? a + '|' + b : b + '|' + a;
  }

  function neighbors(n, idx) {
    var r = (idx / n) | 0, c = idx % n, out = [];
    if (r > 0) out.push(idx - n);
    if (r < n - 1) out.push(idx + n);
    if (c > 0) out.push(idx - 1);
    if (c < n - 1) out.push(idx + 1);
    return out;
  }

  // Random Hamiltonian path: start from a snake, randomize with backbite moves.
  function randomPath(n, rnd) {
    var N = n * n, path = [], pos = new Int32Array(N), i, r, c;
    for (r = 0; r < n; r++) for (c = 0; c < n; c++) path.push(r * n + (r % 2 ? n - 1 - c : c));
    for (i = 0; i < N; i++) pos[path[i]] = i;
    var moves = N * N * 2;
    for (var m = 0; m < moves; m++) {
      if (rnd() < 0.5) { path.reverse(); for (i = 0; i < N; i++) pos[path[i]] = i; }
      var end = path[N - 1], nb = neighbors(n, end), x = nb[(rnd() * nb.length) | 0], j = pos[x];
      if (j === N - 2) continue;
      // reverse path[j+1 .. N-1]
      for (var a = j + 1, b = N - 1; a < b; a++, b--) {
        var t = path[a]; path[a] = path[b]; path[b] = t;
        pos[path[a]] = a; pos[path[b]] = b;
      }
    }
    return path;
  }

  // Count solutions up to 2 (or bail at node limit -> returns 2). Returns {count, alt}.
  function solve(n, numAt, K, blocked, truth, limit) {
    var N = n * n, visited = new Uint8Array(N), path = new Int32Array(N), nodes = 0, count = 0, alt = null;
    var adj = [], i;
    for (i = 0; i < N; i++) adj.push(neighbors(n, i).filter(function (j) { return !blocked[i < j ? i * N + j : j * N + i]; }));
    var start = -1, endCell = -1;
    for (i = 0; i < N; i++) { if (numAt[i] === 1) start = i; if (numAt[i] === K) endCell = i; }
    var stack = new Int32Array(N);

    function feasible(head) {
      // dead-end check: every free non-end cell needs >=2 free/head neighbours
      var free = 0, k, j, a;
      for (k = 0; k < N; k++) {
        if (visited[k]) continue;
        free++;
        var d = 0; a = adj[k];
        for (j = 0; j < a.length; j++) if (!visited[a[j]] || a[j] === head) d++;
        if (d < (k === endCell ? 1 : 2)) return false;
      }
      // connectivity of free cells from head
      var seen = new Uint8Array(N), sp = 0, got = 0;
      a = adj[head];
      for (j = 0; j < a.length; j++) if (!visited[a[j]] && !seen[a[j]]) { seen[a[j]] = 1; stack[sp++] = a[j]; }
      while (sp) {
        var x = stack[--sp]; got++; a = adj[x];
        for (j = 0; j < a.length; j++) if (!visited[a[j]] && !seen[a[j]]) { seen[a[j]] = 1; stack[sp++] = a[j]; }
      }
      return got === free;
    }

    function dfs(cell, depth, next) {
      if (count >= 2 || ++nodes > limit) return;
      path[depth] = cell;
      if (depth === N - 1) {
        count++;
        var same = true;
        for (var q = 0; q < N; q++) if (path[q] !== truth[q]) { same = false; break; }
        if (!same) alt = Array.prototype.slice.call(path);
        return;
      }
      if (cell === endCell || !feasible(cell)) return;
      var a = adj[cell];
      for (var j = 0; j < a.length; j++) {
        var x = a[j];
        if (visited[x]) continue;
        var v = numAt[x];
        if (v && v !== next) continue;
        visited[x] = 1;
        dfs(x, depth + 1, v ? next + 1 : next);
        visited[x] = 0;
      }
    }

    visited[start] = 1;
    dfs(start, 0, 2);
    if (nodes > limit) count = 2;
    return { count: count, alt: alt };
  }

  function generate(size, seed) {
    var n = size | 0, N = n * n, rnd = mulberry32((seed | 0) ^ (n * 0x9E3779B1));
    var maxWalls = n >= 6 ? n - 3 : 0, maxWp = n + 5;
    for (;;) {
      var path = randomPath(n, rnd), pos = new Int32Array(N), i;
      for (i = 0; i < N; i++) pos[path[i]] = i;
      var wp = {}; // path index -> true
      wp[0] = wp[N - 1] = true;
      var initial = n - 1;
      for (i = 1; i < initial; i++) wp[Math.min(N - 2, Math.max(1, Math.round(i * (N - 1) / initial + (rnd() - 0.5) * N / initial * 0.6)))] = true;
      var blocked = {}, walls = 0;
      var isStep = function (a, b) { return Math.abs(pos[a] - pos[b]) === 1; };
      // a couple of random walls up front
      for (var tries = 0; walls < Math.floor(maxWalls / 2) && tries < 50; tries++) {
        var a = (rnd() * N) | 0, nb = neighbors(n, a), b = nb[(rnd() * nb.length) | 0];
        var k = a < b ? a * N + b : b * N + a;
        if (!isStep(a, b) && !blocked[k]) { blocked[k] = 1; walls++; }
      }
      var ok = false;
      for (var iter = 0; iter < 40; iter++) {
        var idxs = Object.keys(wp).map(Number).sort(function (x, y) { return x - y; });
        if (idxs.length > maxWp) break;
        var numAt = new Int32Array(N);
        idxs.forEach(function (pi, rank) { numAt[path[pi]] = rank + 1; });
        var res = solve(n, numAt, idxs.length, blocked, path, 60000);
        if (res.count === 1) { ok = true; break; }
        var alt = res.alt;
        if (alt && walls < maxWalls && rnd() < 0.5) {
          // wall on an edge the alternative uses but the solution doesn't: kills alt for sure
          var cand = [];
          for (i = 0; i + 1 < N; i++) if (!isStep(alt[i], alt[i + 1])) cand.push(i);
          if (cand.length) {
            var e = cand[(rnd() * cand.length) | 0], p = alt[e], q = alt[e + 1];
            blocked[p < q ? p * N + q : q * N + p] = 1; walls++;
            continue;
          }
        }
        // add a waypoint the alternative visits out of order (kills alt); random if solver bailed
        var free = [], altPos = new Int32Array(N), prev = 0;
        if (alt) for (i = 0; i < N; i++) altPos[alt[i]] = i;
        for (i = 1; i < N - 1; i++) {
          if (wp[i]) { prev = i; continue; }
          if (alt) {
            var nx = i + 1; while (!wp[nx]) nx++;
            var ap = altPos[path[i]];
            if (ap > altPos[path[prev]] && ap < altPos[path[nx]]) continue;
          }
          free.push(i);
        }
        if (!free.length) for (i = 1; i < N - 1; i++) if (!wp[i]) free.push(i);
        if (!free.length) break;
        wp[free[(rnd() * free.length) | 0]] = true;
      }
      if (!ok) continue;
      var numbers = {}, wallList = [];
      idxs.forEach(function (pi, rank) { var x = path[pi]; numbers[((x / n) | 0) + ',' + (x % n)] = rank + 1; });
      Object.keys(blocked).forEach(function (k) {
        var a = (k / N) | 0, b = k % N;
        wallList.push(wallKey([(a / n) | 0, a % n], [(b / n) | 0, b % n]));
      });
      return {
        size: n,
        numbers: numbers,
        walls: wallList,
        solution: path.map(function (x) { return [(x / n) | 0, x % n]; })
      };
    }
  }

  function canMove(puzzle, a, b) {
    var n = puzzle.size;
    if (!a || !b || a[0] < 0 || a[1] < 0 || b[0] < 0 || b[1] < 0 || a[0] >= n || a[1] >= n || b[0] >= n || b[1] >= n) return false;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return false;
    return puzzle.walls.indexOf(wallKey(a, b)) < 0;
  }

  function validate(puzzle, path) {
    var n = puzzle.size, K = 0, k;
    for (k in puzzle.numbers) K = Math.max(K, puzzle.numbers[k]);
    if (!path || !path.length) return { complete: false, error: null };
    if (puzzle.numbers[path[0][0] + ',' + path[0][1]] !== 1) return { complete: false, error: "Yol 1'den başlamalı" };
    var seen = {}, next = 1;
    for (var i = 0; i < path.length; i++) {
      var key = path[i][0] + ',' + path[i][1];
      if (i > 0 && !canMove(puzzle, path[i - 1], path[i])) return { complete: false, error: 'Geçersiz hamle' };
      if (seen[key]) return { complete: false, error: 'Bir hücreden iki kez geçilemez' };
      seen[key] = 1;
      var v = puzzle.numbers[key];
      if (v) {
        if (v !== next) return { complete: false, error: 'Sayılar sırayla ziyaret edilmeli' };
        next++;
        if (v === K && i !== path.length - 1) return { complete: false, error: 'Yol ' + K + "'de bitmeli" };
      }
    }
    return { complete: path.length === n * n && next === K + 1, error: null };
  }

  var api = { generate: generate, validate: validate, canMove: canMove };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PatikaGen = api;
})(typeof window !== 'undefined' ? window : this);
