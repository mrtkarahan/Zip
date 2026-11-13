'use strict';
// QA tests for js/generator.js. Run: node tests/generator.test.js
var assert = require('assert');
var path = require('path');
var PatikaGen = require(path.join(__dirname, '..', 'js', 'generator.js'));

var SIZES = [5, 6, 7];
var SEEDS = 30;
var passed = 0, failed = 0, failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) {
    failed++;
    failures.push(name + ': ' + e.message);
    console.log('  FAIL ' + name + '\n       ' + e.message.split('\n')[0]);
  }
}

function key(r, c) { return r + ',' + c; }

// Wall set parsed independently in this test (does not reuse generator internals).
function wallSet(p) {
  var s = {};
  p.walls.forEach(function (w) {
    var parts = w.split('|');
    var a = parts[0].split(',').map(Number), b = parts[1].split(',').map(Number);
    s[key(a[0], a[1]) + '#' + key(b[0], b[1])] = 1;
    s[key(b[0], b[1]) + '#' + key(a[0], a[1])] = 1;
  });
  return s;
}

function crossesWall(p, a, b) {
  return !!wallSet(p)[key(a[0], a[1]) + '#' + key(b[0], b[1])];
}

function adjacent(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; }

function maxNumber(p) {
  var K = 0;
  Object.keys(p.numbers).forEach(function (k) { K = Math.max(K, p.numbers[k]); });
  return K;
}

var cache = {};
function puzzle(size, seed) {
  var k = size + ':' + seed;
  if (!cache[k]) cache[k] = PatikaGen.generate(size, seed);
  return cache[k];
}

// Naive brute-force counter, independent of the generator's solver: DFS over
// simple paths from the number-1 cell, honouring walls, number order and the
// requirement to end on the max number after covering every cell. Stops at limitFound.
function bruteCount(p, limitFound) {
  var n = p.size, N = n * n, K = maxNumber(p), walls = wallSet(p);
  var numAt = {}, start = null;
  Object.keys(p.numbers).forEach(function (k) {
    numAt[k] = p.numbers[k];
    if (p.numbers[k] === 1) start = k.split(',').map(Number);
  });
  var visited = {}, found = 0;
  var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function dfs(cell, depth, nextNum) {
    if (found >= limitFound) return;
    if (depth === N) {
      if (nextNum === K + 1) found++;
      return;
    }
    for (var d = 0; d < 4; d++) {
      var r = cell[0] + dirs[d][0], c = cell[1] + dirs[d][1];
      if (r < 0 || c < 0 || r >= n || c >= n) continue;
      var k = key(r, c);
      if (visited[k]) continue;
      if (walls[key(cell[0], cell[1]) + '#' + k]) continue;
      var v = numAt[k] || 0;
      if (v && v !== nextNum) continue;
      if (v === K && depth + 1 !== N) continue; // path must END on the max number
      visited[k] = 1;
      dfs([r, c], depth + 1, v ? nextNum + 1 : nextNum);
      delete visited[k];
      if (found >= limitFound) return;
    }
  }
  visited[key(start[0], start[1])] = 1;
  dfs(start, 1, 2);
  return found;
}

// BFS route from a to b avoiding forbidden cells and walls. Returns list of cells or null.
function bfsRoute(p, a, b, forbidden) {
  var n = p.size, forb = {};
  forbidden.forEach(function (c) { forb[key(c[0], c[1])] = 1; });
  var prev = {}, q = [a], seen = {};
  seen[key(a[0], a[1])] = 1;
  while (q.length) {
    var cur = q.shift();
    if (cur[0] === b[0] && cur[1] === b[1]) {
      var out = [], c = cur;
      while (c) { out.unshift(c); c = prev[key(c[0], c[1])]; }
      return out;
    }
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nb = [cur[0] + d[0], cur[1] + d[1]], k = key(nb[0], nb[1]);
      if (nb[0] < 0 || nb[1] < 0 || nb[0] >= n || nb[1] >= n) return;
      if (seen[k] || forb[k] || crossesWall(p, cur, nb)) return;
      seen[k] = 1; prev[k] = cur; q.push(nb);
    });
  }
  return null;
}

var seedsFor = function (size) {
  var out = [];
  for (var s = 1; s <= SEEDS; s++) out.push(s * 7919 + size * 101);
  return out;
};

// ---- generator properties ----
console.log('generator properties (sizes ' + SIZES.join(',') + ', ' + SEEDS + ' seeds each)');
SIZES.forEach(function (size) {
  var seeds = seedsFor(size);

  test('size ' + size + ': determinism (same seed => identical JSON)', function () {
    seeds.forEach(function (sd) {
      var a = JSON.stringify(PatikaGen.generate(size, sd));
      var b = JSON.stringify(PatikaGen.generate(size, sd));
      assert.strictEqual(a, b, 'seed ' + sd);
    });
  });

  test('size ' + size + ': solution length size*size, all cells unique and in bounds', function () {
    seeds.forEach(function (sd) {
      var p = puzzle(size, sd), seen = {};
      assert.strictEqual(p.size, size);
      assert.strictEqual(p.solution.length, size * size, 'seed ' + sd + ' length');
      p.solution.forEach(function (c) {
        assert.ok(c[0] >= 0 && c[0] < size && c[1] >= 0 && c[1] < size, 'seed ' + sd + ' out of bounds ' + c);
        var k = key(c[0], c[1]);
        assert.ok(!seen[k], 'seed ' + sd + ' repeated cell ' + k);
        seen[k] = 1;
      });
    });
  });

  test('size ' + size + ': solution starts on 1, ends on max, numbers in order', function () {
    seeds.forEach(function (sd) {
      var p = puzzle(size, sd), sol = p.solution, K = maxNumber(p);
      assert.strictEqual(p.numbers[key(sol[0][0], sol[0][1])], 1, 'seed ' + sd + ' start');
      var last = sol[sol.length - 1];
      assert.strictEqual(p.numbers[key(last[0], last[1])], K, 'seed ' + sd + ' end');
      var expect = 1;
      sol.forEach(function (c) {
        var v = p.numbers[key(c[0], c[1])];
        if (v) { assert.strictEqual(v, expect, 'seed ' + sd + ' order'); expect++; }
      });
      assert.strictEqual(expect, K + 1, 'seed ' + sd + ' not all numbers visited along solution');
      var onSol = {};
      sol.forEach(function (c) { onSol[key(c[0], c[1])] = 1; });
      Object.keys(p.numbers).forEach(function (k) {
        assert.ok(onSol[k], 'seed ' + sd + ' number ' + k + ' not on solution');
      });
    });
  });

  test('size ' + size + ': solution steps adjacent, never cross a wall, canMove true', function () {
    seeds.forEach(function (sd) {
      var p = puzzle(size, sd), sol = p.solution;
      for (var i = 1; i < sol.length; i++) {
        assert.ok(adjacent(sol[i - 1], sol[i]), 'seed ' + sd + ' non-adjacent at ' + i);
        assert.ok(!crossesWall(p, sol[i - 1], sol[i]), 'seed ' + sd + ' wall crossed at ' + i);
        assert.ok(PatikaGen.canMove(p, sol[i - 1], sol[i]), 'seed ' + sd + ' canMove false at ' + i);
      }
    });
  });

  test('size ' + size + ': validate(p, solution).complete === true', function () {
    seeds.forEach(function (sd) {
      var p = puzzle(size, sd), v = PatikaGen.validate(p, p.solution);
      assert.strictEqual(v.complete, true, 'seed ' + sd + ' error=' + v.error);
      assert.strictEqual(v.error, null);
    });
  });

  test('size ' + size + ': wall strings well-formed (r,c|r,c, adjacent, smaller first)', function () {
    seeds.forEach(function (sd) {
      puzzle(size, sd).walls.forEach(function (w) {
        var parts = w.split('|');
        assert.strictEqual(parts.length, 2, 'seed ' + sd + ' bad wall ' + w);
        var a = parts[0].split(',').map(Number), b = parts[1].split(',').map(Number);
        assert.ok(adjacent(a, b), 'seed ' + sd + ' non-adjacent wall ' + w);
        assert.ok(a[0] * size + a[1] < b[0] * size + b[1], 'seed ' + sd + ' wall order ' + w);
      });
    });
  });
});

// ---- validate negatives / partials ----
console.log('validate');
(function () {
  var p = puzzle(5, 12345), sol = p.solution, K = maxNumber(p);

  test('rejects path not starting at 1', function () {
    var v = PatikaGen.validate(p, sol.slice(1, 4));
    assert.strictEqual(v.complete, false);
    assert.ok(v.error, 'expected error string, got ' + JSON.stringify(v));
  });

  test('rejects non-adjacent step', function () {
    var bad = [sol[0], sol[2]].concat(sol.slice(3));
    var v = PatikaGen.validate(p, bad);
    assert.strictEqual(v.complete, false);
    assert.ok(v.error, 'expected error, got ' + JSON.stringify(v));
  });

  test('rejects repeated cell', function () {
    var bad = sol.slice(0, 3).concat([sol[1]]);
    var v = PatikaGen.validate(p, bad);
    assert.strictEqual(v.complete, false);
    assert.ok(v.error, 'expected error, got ' + JSON.stringify(v));
  });

  test('rejects numbers out of order (3 visited before 2)', function () {
    var idx2 = -1, idx3 = -1;
    sol.forEach(function (c, i) {
      var v = p.numbers[key(c[0], c[1])];
      if (v === 2) idx2 = i;
      if (v === 3) idx3 = i;
    });
    assert.ok(idx2 > 0 && idx3 > idx2, 'fixture needs 2 before 3 on solution');
    // Route from 1 straight to 3 without touching 2 (BFS avoiding cell 2): 3 is reached before 2.
    var route = bfsRoute(p, sol[0], sol[idx3], [sol[idx2]]);
    assert.ok(route, 'could not build out-of-order route');
    var v = PatikaGen.validate(p, route);
    assert.strictEqual(v.complete, false);
    assert.ok(v.error, 'expected error for out-of-order numbers, got ' + JSON.stringify(v));
  });

  test('partial correct path => complete false, error null', function () {
    [1, 3, 10, 17].forEach(function (len) {
      var v = PatikaGen.validate(p, sol.slice(0, len));
      assert.strictEqual(v.complete, false, 'len ' + len);
      assert.strictEqual(v.error, null, 'len ' + len + ' error=' + v.error);
    });
  });

  test('empty path => complete false, error null', function () {
    assert.deepStrictEqual(PatikaGen.validate(p, []), { complete: false, error: null });
  });

  test('continuing past the max number is rejected', function () {
    // The solution always ends on K, so build a path that reaches K early (BFS), then steps on.
    var route = bfsRoute(p, sol[0], sol[sol.length - 1], []);
    assert.ok(route && route.length < sol.length, 'fixture: BFS route to K must be shorter');
    var last = route[route.length - 1], onRoute = {}, ext = null;
    route.forEach(function (c) { onRoute[key(c[0], c[1])] = 1; });
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var nb = [last[0] + d[0], last[1] + d[1]];
      if (!ext && nb[0] >= 0 && nb[1] >= 0 && nb[0] < p.size && nb[1] < p.size &&
          !onRoute[key(nb[0], nb[1])] && !crossesWall(p, last, nb)) ext = nb;
    });
    assert.ok(ext, 'fixture: no free neighbour beyond K');
    var v = PatikaGen.validate(p, route.concat([ext]));
    assert.strictEqual(v.complete, false);
    assert.ok(v.error, 'expected error when continuing past max number, got ' + JSON.stringify(v));
  });
})();

// ---- uniqueness via independent brute force ----
console.log('uniqueness (independent brute-force DFS, stops at 2)');
[5, 6].forEach(function (size) {
  test('size ' + size + ': exactly 1 solution for 5 seeds', function () {
    for (var s = 1; s <= 5; s++) {
      var sd = s * 31337 + size;
      var c = bruteCount(puzzle(size, sd), 2);
      assert.strictEqual(c, 1, 'size ' + size + ' seed ' + sd + ' solution count ' + c);
    }
  });
});

// ---- timing ----
console.log('timing');
test('size 7 generation < 200ms per puzzle', function () {
  var max = 0, maxSeed = null, total = 0;
  seedsFor(7).forEach(function (sd) {
    var t0 = process.hrtime.bigint();
    PatikaGen.generate(7, sd);
    var ms = Number(process.hrtime.bigint() - t0) / 1e6;
    total += ms;
    if (ms > max) { max = ms; maxSeed = sd; }
  });
  console.log('       size 7 max ' + max.toFixed(1) + 'ms (seed ' + maxSeed + '), avg ' + (total / SEEDS).toFixed(1) + 'ms over ' + SEEDS);
  assert.ok(max < 200, 'max ' + max.toFixed(1) + 'ms seed ' + maxSeed);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) { console.log(failures.join('\n')); process.exitCode = 1; }
