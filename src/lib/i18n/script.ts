import { LANGUAGE_COOKIE } from ".";

/** Runs before the first paint: resolves the language onto <html lang> and keeps the page hidden until React shows it in that language. */
export const LANGUAGE_SCRIPT = `(function(){try{var h=document.documentElement,m=document.cookie.match(/(?:^|; )${LANGUAGE_COOKIE}=(ja|en)(?:;|$)/),l=m&&m[1];if(!l){var a=navigator.languages||[navigator.language||""];for(var i=0;i<a.length&&!l;i++){var c=String(a[i]).slice(0,2).toLowerCase();if(c==="ja"||c==="en")l=c}}l=l||"ja";h.lang=l;if(l!=="ja"){h.setAttribute("data-lang-pending","");setTimeout(function(){h.removeAttribute("data-lang-pending")},3000)}}catch(e){}})()`;
