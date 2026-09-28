/* ---- overgenomen uit ui.js ---- */

var $ = function (id) { return document.getElementById(id); }

function el(tag, className, text) {
  var n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}
