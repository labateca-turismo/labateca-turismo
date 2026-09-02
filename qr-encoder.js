/* ============================================================
   qr-encoder.js — generador de códigos QR, sin dependencias.

   POR QUÉ EXISTE
   La página /qr cargaba la librería qrcodejs desde cdnjs. La CSP del
   sitio solo permite scripts de 'self' y de Cloudflare, así que el
   navegador la bloqueaba: en producción `QRCode` era `undefined` y no
   se pintaba NI UN código. La página estuvo rota desde el primer día.
   Servido desde el propio sitio, 'self' lo permite y funciona.

   Sirve para las dos cosas: se puede pedir con require() desde Node
   (gen_qr.js arma el SVG del cartel) y con <script src> desde el
   navegador (la página /qr arma los 111 carteles).

   ALCANCE
   Modo byte (que es lo que son las URL) y versiones 1 a 10. A nivel H
   eso da hasta 119 caracteres: de sobra para cualquier URL del sitio.
   Si no cabe, revienta con un mensaje claro en vez de callarse.

   Referencia: ISO/IEC 18004.
   ============================================================ */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.QRLab = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ── Campo de Galois GF(256), polinomio 0x11d ───────────── */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    for (var i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* Polinomio generador de grado n. */
  function generador(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var q = new Array(p.length + 1);
      for (var k = 0; k < q.length; k++) q[k] = 0;
      for (var j = 0; j < p.length; j++) {
        q[j]     ^= p[j];
        q[j + 1] ^= mul(p[j], EXP[i]);
      }
      p = q;
    }
    return p;
  }

  /* Corrección de errores Reed-Solomon: n codewords para estos datos. */
  function correccion(datos, n) {
    var g = generador(n), r = datos.slice(), i, j;
    for (i = 0; i < n; i++) r.push(0);
    for (i = 0; i < datos.length; i++) {
      var f = r[i];
      if (f === 0) continue;
      for (j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], f);
    }
    return r.slice(datos.length);
  }

  /* ── Tablas por versión y nivel ──────────────────────────
     [codewords de corrección por bloque, bloques grupo 1,
      datos por bloque grupo 1, bloques grupo 2, datos por bloque g2] */
  var BLOQUES = {
    1:  { L:[7,1,19,0,0],    M:[10,1,16,0,0],   Q:[13,1,13,0,0],   H:[17,1,9,0,0]    },
    2:  { L:[10,1,34,0,0],   M:[16,1,28,0,0],   Q:[22,1,22,0,0],   H:[28,1,16,0,0]   },
    3:  { L:[15,1,55,0,0],   M:[26,1,44,0,0],   Q:[18,2,17,0,0],   H:[22,2,13,0,0]   },
    4:  { L:[20,1,80,0,0],   M:[18,2,32,0,0],   Q:[26,2,24,0,0],   H:[16,4,9,0,0]    },
    5:  { L:[26,1,108,0,0],  M:[24,2,43,0,0],   Q:[18,2,15,2,16],  H:[22,2,11,2,12]  },
    6:  { L:[18,2,68,0,0],   M:[16,4,27,0,0],   Q:[24,4,19,0,0],   H:[28,4,15,0,0]   },
    7:  { L:[20,2,78,0,0],   M:[18,4,31,0,0],   Q:[18,2,14,4,15],  H:[26,4,13,1,14]  },
    8:  { L:[24,2,97,0,0],   M:[22,2,38,2,39],  Q:[22,4,18,2,19],  H:[26,4,14,2,15]  },
    9:  { L:[30,2,116,0,0],  M:[22,3,36,2,37],  Q:[20,4,16,4,17],  H:[24,4,12,4,13]  },
    10: { L:[18,2,68,2,69],  M:[26,4,43,1,44],  Q:[24,6,19,2,20],  H:[28,6,15,2,16]  }
  };

  /* Centros de los patrones de alineación. */
  var ALINEACION = {
    1:[], 2:[6,18], 3:[6,22], 4:[6,26], 5:[6,30],
    6:[6,34], 7:[6,22,38], 8:[6,24,42], 9:[6,26,46], 10:[6,28,50]
  };

  var NIVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function datosDe(v, nivel) {
    var b = BLOQUES[v][nivel];
    return b[1] * b[2] + b[3] * b[4];
  }

  /* ── Flujo de bits ───────────────────────────────────────── */
  function Bits() { this.b = []; }
  Bits.prototype.push = function (valor, n) {
    for (var i = n - 1; i >= 0; i--) this.b.push((valor >>> i) & 1);
  };

  function bytesDe(texto) {
    /* La URL es ASCII, pero si alguien mete una tilde hay que
       codificarla en UTF-8 o el lector devuelve basura. */
    if (typeof TextEncoder === "function") return Array.from(new TextEncoder().encode(texto));
    var a = [], i, c;
    for (i = 0; i < texto.length; i++) {
      c = texto.charCodeAt(i);
      if (c < 0x80) a.push(c);
      else if (c < 0x800) a.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else a.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return a;
  }

  function versionPara(nBytes, nivel) {
    for (var v = 1; v <= 10; v++) {
      var cuenta = v < 10 ? 8 : 16;
      var bits = 4 + cuenta + nBytes * 8;
      if (bits <= datosDe(v, nivel) * 8) return v;
    }
    throw new Error("QR: " + nBytes + " bytes no caben en nivel " + nivel +
                    " hasta la version 10. Acorta la URL o baja el nivel de correccion.");
  }

  /* ── Codewords finales, ya intercalados ──────────────────── */
  function codewords(texto, nivel, v) {
    var datos = bytesDe(texto);
    var cuenta = v < 10 ? 8 : 16;
    var bs = new Bits();
    bs.push(0b0100, 4);            // modo byte
    bs.push(datos.length, cuenta);
    for (var i = 0; i < datos.length; i++) bs.push(datos[i], 8);

    var total = datosDe(v, nivel) * 8;
    var term = Math.min(4, total - bs.b.length);
    bs.push(0, term);
    while (bs.b.length % 8) bs.b.push(0);

    var relleno = [0xec, 0x11], k = 0;
    while (bs.b.length < total) { bs.push(relleno[k++ % 2], 8); }

    var cw = [];
    for (i = 0; i < bs.b.length; i += 8) {
      var byte = 0;
      for (var j = 0; j < 8; j++) byte = (byte << 1) | bs.b[i + j];
      cw.push(byte);
    }

    /* Repartir en bloques y calcular la corrección de cada uno. */
    var b = BLOQUES[v][nivel], nEc = b[0];
    var bloques = [], p = 0, n;
    for (n = 0; n < b[1]; n++) { bloques.push(cw.slice(p, p + b[2])); p += b[2]; }
    for (n = 0; n < b[3]; n++) { bloques.push(cw.slice(p, p + b[4])); p += b[4]; }
    var ecs = bloques.map(function (x) { return correccion(x, nEc); });

    /* Intercalado: primero los datos, después la corrección. */
    var salida = [], maxD = Math.max.apply(null, bloques.map(function (x) { return x.length; }));
    for (i = 0; i < maxD; i++) for (n = 0; n < bloques.length; n++) if (i < bloques[n].length) salida.push(bloques[n][i]);
    for (i = 0; i < nEc; i++) for (n = 0; n < ecs.length; n++) salida.push(ecs[n][i]);
    return salida;
  }

  /* ── Matriz ──────────────────────────────────────────────── */
  function nuevaMatriz(size) {
    var m = [];
    for (var i = 0; i < size; i++) { m.push(new Array(size)); for (var j = 0; j < size; j++) m[i][j] = null; }
    return m;
  }

  function ponerPatrones(m, v) {
    var size = m.length, i, j, r, c;

    function finder(fr, fc) {
      for (i = -1; i <= 7; i++) for (j = -1; j <= 7; j++) {
        r = fr + i; c = fc + j;
        if (r < 0 || c < 0 || r >= size || c >= size) continue;
        var dentro = (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
                     (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
                     (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        m[r][c] = dentro ? 1 : 0;
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    /* Temporización */
    for (i = 8; i < size - 8; i++) { var t = (i % 2 === 0) ? 1 : 0; m[6][i] = t; m[i][6] = t; }

    /* Alineación. Se omiten SOLO las tres que caerían encima de un
       patrón de búsqueda (las tres esquinas). La del cruce con la línea
       de temporización —por ejemplo el centro (6,22) en la versión 7—
       SÍ va, y pisa la temporización: así lo manda la norma. Filtrar
       por "la celda ya está ocupada" se saltaba esa y rompía el código
       de la versión 7 en adelante. */
    var ejes = ALINEACION[v], ult = ejes.length - 1;
    for (i = 0; i <= ult; i++) for (j = 0; j <= ult; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ult) || (i === ult && j === 0)) continue;
      r = ejes[i]; c = ejes[j];
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
        m[r + dr][c + dc] = (Math.max(Math.abs(dr), Math.abs(dc)) !== 1) ? 1 : 0;
      }
    }

    /* Módulo siempre negro */
    m[size - 8][8] = 1;

    /* Reservar el área de formato */
    for (i = 0; i <= 8; i++) {
      if (m[8][i] === null) m[8][i] = 0;
      if (m[i][8] === null) m[i][8] = 0;
    }
    for (i = 0; i < 8; i++) {
      if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0;
      if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0;
    }
  }

  /* Marca qué celdas son función (no llevan datos). */
  function mapaFuncion(v, size) {
    var f = nuevaMatriz(size);
    ponerPatrones(f, v);
    var esF = [];
    for (var i = 0; i < size; i++) { esF.push([]); for (var j = 0; j < size; j++) esF[i].push(f[i][j] !== null); }
    if (v >= 7) {
      for (i = 0; i < 6; i++) for (j = 0; j < 3; j++) {
        esF[i][size - 11 + j] = true;
        esF[size - 11 + j][i] = true;
      }
    }
    return esF;
  }

  function ponerDatos(m, esF, cw) {
    var size = m.length, bits = [], i, j;
    for (i = 0; i < cw.length; i++) for (j = 7; j >= 0; j--) bits.push((cw[i] >>> j) & 1);

    var idx = 0, arriba = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                       // la columna de temporización se salta
      for (var n = 0; n < size; n++) {
        var fila = arriba ? size - 1 - n : n;
        for (var k = 0; k < 2; k++) {
          var c = col - k;
          if (esF[fila][c]) continue;
          m[fila][c] = idx < bits.length ? bits[idx] : 0;
          idx++;
        }
      }
      arriba = !arriba;
    }
  }

  var MASCARAS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r)    { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];

  function formato(nivel, mascara) {
    var datos = (NIVEL_BITS[nivel] << 3) | mascara;
    var r = datos << 10;
    for (var i = 14; i >= 10; i--) if ((r >>> i) & 1) r ^= 0x537 << (i - 10);
    return ((datos << 10) | r) ^ 0x5412;
  }

  function versionInfo(v) {
    var r = v << 12;
    for (var i = 17; i >= 12; i--) if ((r >>> i) & 1) r ^= 0x1f25 << (i - 12);
    return (v << 12) | r;
  }

  function ponerFormato(m, nivel, mascara) {
    var size = m.length, f = formato(nivel, mascara), i, bit;
    /* Comprobado módulo a módulo contra un QR real de referencia: el
       recorrido va al revés de lo que parece natural. El bit 0 (el menos
       significativo) va arriba, en (0,8), y el 14 abajo a la izquierda,
       en (8,0). Ponerlo al derecho da un formato que ningún lector
       reconoce, aunque el resto del código sea correcto. */
    for (i = 0; i < 15; i++) {
      bit = (f >>> i) & 1;
      /* Copia 1: baja por la columna 8, salta la temporización de (6,8),
         cruza la esquina y sigue por la fila 8 hacia la izquierda. */
      if (i < 6)        m[i][8] = bit;
      else if (i === 6) m[7][8] = bit;
      else if (i === 7) m[8][8] = bit;
      else if (i === 8) m[8][7] = bit;
      else              m[8][14 - i] = bit;      // i=9 → (8,5) … i=14 → (8,0)
      /* Copia 2: OCHO bits por la fila 8 desde el borde derecho y SIETE
         subiendo por la columna 8 desde abajo. El módulo oscuro fijo de
         (size-8, 8) queda fuera de ese recorrido, como debe. */
      if (i < 8) m[8][size - 1 - i] = bit;
      else       m[size + 7 - i][8] = bit;       // i=8 → fila size-1 … i=14 → size-7
    }
  }

  function ponerVersion(m, v) {
    if (v < 7) return;
    var size = m.length, info = versionInfo(v);
    for (var i = 0; i < 18; i++) {
      var bit = (info >>> i) & 1;
      var a = Math.floor(i / 3), b = i % 3;
      m[a][size - 11 + b] = bit;
      m[size - 11 + b][a] = bit;
    }
  }

  /* ── Penalización, para elegir la máscara ────────────────── */
  function penalizacion(m) {
    var size = m.length, p = 0, i, j, n, ant, oscuros = 0;

    /* Regla 1: cinco o más iguales seguidos */
    for (i = 0; i < size; i++) {
      for (var eje = 0; eje < 2; eje++) {
        n = 1; ant = -1;
        for (j = 0; j < size; j++) {
          var val = eje === 0 ? m[i][j] : m[j][i];
          if (val === ant) { n++; if (n === 5) p += 3; else if (n > 5) p++; }
          else { ant = val; n = 1; }
        }
      }
    }
    /* Regla 2: bloques de 2x2 */
    for (i = 0; i < size - 1; i++) for (j = 0; j < size - 1; j++) {
      var v0 = m[i][j];
      if (v0 === m[i][j + 1] && v0 === m[i + 1][j] && v0 === m[i + 1][j + 1]) p += 3;
    }
    /* Regla 3: el patrón que se confunde con un finder */
    var A = [1,0,1,1,1,0,1,0,0,0,0], B = [0,0,0,0,1,0,1,1,1,0,1];
    function coincide(get, k, pat) {
      for (var q = 0; q < 11; q++) if (get(k + q) !== pat[q]) return false;
      return true;
    }
    for (i = 0; i < size; i++) for (j = 0; j <= size - 11; j++) {
      var filaGet = (function (r) { return function (c) { return m[r][c]; }; })(i);
      var colGet  = (function (c) { return function (r) { return m[r][c]; }; })(i);
      if (coincide(filaGet, j, A) || coincide(filaGet, j, B)) p += 40;
      if (coincide(colGet,  j, A) || coincide(colGet,  j, B)) p += 40;
    }
    /* Regla 4: proporción de oscuros lejos del 50 % */
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (m[i][j]) oscuros++;
    var pct = oscuros * 100 / (size * size);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  /* ── API ─────────────────────────────────────────────────── */
  function matriz(texto, nivel) {
    nivel = nivel || "H";
    if (!NIVEL_BITS.hasOwnProperty(nivel)) throw new Error("QR: nivel invalido " + nivel);
    var v = versionPara(bytesDe(texto).length, nivel);
    var size = v * 4 + 17;
    var cw = codewords(texto, nivel, v);
    var esF = mapaFuncion(v, size);

    var mejor = null, mejorP = Infinity;
    for (var k = 0; k < 8; k++) {
      var m = nuevaMatriz(size);
      ponerPatrones(m, v);
      ponerVersion(m, v);
      ponerDatos(m, esF, cw);
      for (var i = 0; i < size; i++) for (var j = 0; j < size; j++) {
        if (!esF[i][j] && MASCARAS[k](i, j)) m[i][j] ^= 1;
      }
      ponerFormato(m, nivel, k);
      var p = penalizacion(m);
      if (p < mejorP) { mejorP = p; mejor = m; }
    }
    return { size: size, version: v, nivel: nivel, modulos: mejor };
  }

  /* SVG en vectores: se imprime nítido a cualquier tamaño, que es
     justo lo que hace falta para un cartel pegado en la calle. */
  function svg(texto, opciones) {
    opciones = opciones || {};
    var nivel  = opciones.nivel  || "H";
    var margen = opciones.margen == null ? 4 : opciones.margen;   // zona de silencio
    var color  = opciones.color  || "#16352a";
    var fondo  = opciones.fondo  || "#ffffff";
    var q = matriz(texto, nivel);
    var lado = q.size + margen * 2;

    /* Un solo <path>: pesa mucho menos que un <rect> por módulo. */
    var d = "";
    for (var i = 0; i < q.size; i++) {
      for (var j = 0; j < q.size; j++) {
        if (!q.modulos[i][j]) continue;
        var largo = 1;
        while (j + largo < q.size && q.modulos[i][j + largo]) largo++;
        d += "M" + (j + margen) + " " + (i + margen) + "h" + largo + "v1h-" + largo + "z";
        j += largo - 1;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + lado + ' ' + lado + '" ' +
           'width="' + lado * 4 + '" height="' + lado * 4 + '" shape-rendering="crispEdges" ' +
           'role="img" aria-label="' + (opciones.alt || "Código QR") + '">' +
           (fondo === "none" ? "" : '<rect width="' + lado + '" height="' + lado + '" fill="' + fondo + '"/>') +
           '<path d="' + d + '" fill="' + color + '"/></svg>';
  }

  return { matriz: matriz, svg: svg };
});
