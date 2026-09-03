// Script de paginación del documento imprimible de cotización.
//
// Se inyecta como texto dentro de un <script> del HTML autónomo que arma
// `buildCotizacionHTML` (src/lib/cotizacion-html.ts). No es un módulo que se
// ejecute en el servidor: es una cadena que corre en el navegador del usuario.
//
// Qué hace: toma el markup en bloques que vive en `#source` y lo reparte en
// hojas A4 de alto fijo (`.sheet`), cada una con su encabezado, su cuerpo y su
// footer con "Página X de N". Lo que se ve en pantalla queda 1:1 con lo que se
// imprime.
//
// Contrato con el HTML:
//   #source                     contenedor del markup fuente (se oculta al terminar)
//   #source > #hd-full          encabezado completo (hoja 1) — visible en fallback
//   #source > #tpl-hd-compact   <template> del encabezado compacto (hojas 2+)
//   #source > #tpl-ft           <template> del footer, con un <span class="pageno">
//   #source > .blk[data-blk]    bloques de contenido en orden: info | items | notas | disclaimer
//   .blk[data-blk="items"] table              tabla de ítems (thead + tbody)
//   tbody > tr[data-row="group"|"item"|"totals"]
//   #doc                        contenedor destino de las hojas
//   window.__cotizacionAutoPrint  si es true, imprime al terminar
//
// Si algo falla, `#source` queda visible (documento completo en un flujo, sin
// paginar) — degradación preferible a un documento en blanco.

export const PAGINATE_JS = String.raw`
(function () {
  function run() {
    var source = document.getElementById('source');
    var doc = document.getElementById('doc');
    if (!source || !doc) return;

    var hdFull = document.getElementById('hd-full');
    var tplHdCompact = document.getElementById('tpl-hd-compact');
    var tplFt = document.getElementById('tpl-ft');
    if (!hdFull || !tplHdCompact || !tplFt) return;

    var blocks = Array.prototype.slice.call(source.children).filter(function (el) {
      return el.classList.contains('blk');
    });

    var sheets = [];
    var body = null;

    function headerNode(variant) {
      if (variant === 'full') return hdFull.cloneNode(true);
      return tplHdCompact.content.firstElementChild.cloneNode(true);
    }

    function newSheet(variant) {
      var sheet = document.createElement('div');
      sheet.className = 'sheet';

      var hd = document.createElement('div');
      hd.className = 'sheet__hd';
      var h = headerNode(variant);
      h.removeAttribute('id');
      hd.appendChild(h);

      body = document.createElement('div');
      body.className = 'sheet__bd';

      var ft = document.createElement('div');
      ft.className = 'sheet__ft';
      ft.appendChild(tplFt.content.firstElementChild.cloneNode(true));

      sheet.appendChild(hd);
      sheet.appendChild(body);
      sheet.appendChild(ft);
      doc.appendChild(sheet);
      sheets.push(sheet);
    }

    function fits() {
      return body.scrollHeight <= body.clientHeight + 1;
    }

    function freshItemsTable(srcTable) {
      var t = srcTable.cloneNode(true);
      var tb = t.querySelector('tbody');
      while (tb.firstChild) tb.removeChild(tb.firstChild);
      body.appendChild(t);
      return t;
    }

    function paginateTable(blk) {
      var srcTable = blk.querySelector('table');
      var rows = Array.prototype.slice.call(srcTable.querySelectorAll('tbody > tr'));

      // Agrupar en chunks:
      //  - cada fila item/group es su propio chunk (pueden repartirse).
      //  - los subtotales pueden repartirse entre hojas, PERO la fila 'total'
      //    va pegada al último subtotal (y nunca sola arriba de una hoja).
      var chunks = [];
      var i = 0;
      for (; i < rows.length; i++) {
        var k = rows[i].getAttribute('data-row');
        if (k === 'subtotal' || k === 'total') break;
        chunks.push([rows[i]]);
      }
      var tail = rows.slice(i);
      if (tail.length <= 2) {
        if (tail.length) chunks.push(tail);
      } else {
        for (var j = 0; j < tail.length - 2; j++) chunks.push([tail[j]]);
        chunks.push(tail.slice(-2));
      }

      var table = freshItemsTable(srcTable);
      var tbody = table.querySelector('tbody');

      for (var c = 0; c < chunks.length; c++) {
        var chunk = chunks[c];
        var added = chunk.map(function (r) {
          var clone = r.cloneNode(true);
          tbody.appendChild(clone);
          return clone;
        });

        if (fits() || tbody.children.length === added.length) continue;

        // No cabe: revertir el chunk y arrancar hoja nueva.
        added.forEach(function (n) { tbody.removeChild(n); });

        // Encabezado de grupo huérfano: si la última fila que quedó es un
        // 'group', arrastrarlo a la hoja siguiente.
        var carry = [];
        var last = tbody.lastElementChild;
        if (last && last.getAttribute('data-row') === 'group') {
          carry.push(last);
          tbody.removeChild(last);
        }

        newSheet('compact');
        table = freshItemsTable(srcTable);
        tbody = table.querySelector('tbody');
        carry.concat(chunk).forEach(function (r) {
          tbody.appendChild(r.cloneNode(true));
        });
      }

      // Si una hoja quedó con la tabla conteniendo sólo filas 'totals',
      // ocultar su thead (no hay ítems que rotular).
      doc.querySelectorAll('.sheet__bd table').forEach(function (t) {
        var trs = t.querySelectorAll('tbody > tr');
        var onlyTotals = trs.length > 0;
        trs.forEach(function (tr) {
          var r = tr.getAttribute('data-row');
          if (r !== 'subtotal' && r !== 'total') onlyTotals = false;
        });
        var thead = t.querySelector('thead');
        if (thead) thead.style.display = onlyTotals ? 'none' : '';
      });
    }

    newSheet('full');

    for (var b = 0; b < blocks.length; b++) {
      var blk = blocks[b];
      if (blk.getAttribute('data-blk') === 'items') {
        paginateTable(blk);
        continue;
      }
      var clone = blk.cloneNode(true);
      body.appendChild(clone);
      if (!fits() && body.children.length > 1) {
        body.removeChild(clone);
        newSheet('compact');
        body.appendChild(clone);
      }
    }

    var total = sheets.length;
    for (var s = 0; s < total; s++) {
      var pageno = sheets[s].querySelector('.sheet__ft .pageno');
      if (pageno) pageno.textContent = 'Página ' + (s + 1) + ' de ' + total;
    }

    source.style.display = 'none';
    window.__cotizacionPaginada = total;

    if (window.__cotizacionAutoPrint) {
      window.setTimeout(function () { window.print(); }, 0);
    }
  }

  function boot() {
    var fontsReady = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();
    var imgs = Array.prototype.slice.call(document.images).map(function (img) {
      if (img.decode) return img.decode().catch(function () {});
      return Promise.resolve();
    });
    Promise.all([fontsReady].concat(imgs)).then(function () {
      try {
        run();
      } catch (err) {
        // Dejar #source visible (documento sin paginar).
        if (window.console) window.console.error('paginación cotización falló', err);
        window.__cotizacionPaginada = -1;
      }
    });
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
`
