import * as httpUtil from './http';

function fetchVocab() {
  return new Promise((resolve, reject) => {
    httpUtil.getContent('/vocab/', 'application/ld+json').then((response) => {
      resolve(JSON.parse(response));
    }, (error) => {
      reject('Error loading vocabulary...', error);
    });
  });
}

export function getVocab() {
  // 8 hours
  const cacheTTL = 28800000;

  return new Promise((resolve) => {
    const vocab = JSON.parse(localStorage.getItem('vocab'));

    let isFresh = false;
    if (vocab) {
      isFresh = (new Date().getTime() - vocab.cacheTime < cacheTTL);
    }

    if (vocab && isFresh) {
      resolve(vocab);
    } else {
      fetchVocab().then((result) => {
        const fetchedVocab = result;
        fetchedVocab.cacheTime = new Date().getTime();
        localStorage.setItem('vocab', JSON.stringify(fetchedVocab));
        resolve(fetchedVocab);
      });
    }
  });
}
