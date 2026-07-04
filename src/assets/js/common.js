import GLightbox from 'glightbox';

let lastFocusedElement = null;

GLightbox({
  selector: '.glightbox',
  touchNavigation: true,
  loop: false,
  onOpen: () => {
    lastFocusedElement = document.activeElement;
    const container = document.getElementById('glightbox-body');
    container?.querySelector('.gclose')?.setAttribute('aria-label', '閉じる');
    container?.querySelector('.gprev')?.setAttribute('aria-label', '前へ');
    container?.querySelector('.gnext')?.setAttribute('aria-label', '次へ');
    container?.querySelector('.gclose')?.focus();
  },
  onClose: () => {
    lastFocusedElement?.focus();
  },
});
