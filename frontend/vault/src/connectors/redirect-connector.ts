import '../style.css';

const fragment = window.location.hash.replace(/^#/, '');
if (fragment) {
  window.location.replace(`${window.location.origin}/#/${fragment.replace(/^\/+/, '')}`);
} else {
  window.location.replace(`${window.location.origin}/#/login`);
}
