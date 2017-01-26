import * as _ from 'lodash';
import * as httpUtil from './http';
import * as EditUtil from './edit';
import * as VocabUtil from './vocab';
import * as StringUtil from './string';

function fetchDisplayDefinitions() {
  return new Promise((resolve, reject) => {
    httpUtil.get({ url: 'https://id.kb.se/vocab/display', accept: 'application/ld+json' }).then((response) => {
      resolve(response);
    }, (error) => {
      reject(`Couldn't fetch display definitions: ${error}`);
    });
  });
}

export function getDisplayDefinitions() {
  // 8 hours
  const cacheTTL = 28800000;

  return new Promise((resolve, reject) => {
    const displayDefs = JSON.parse(localStorage.getItem('display'));

    let isFresh = false;
    if (displayDefs) {
      isFresh = (new Date().getTime() - displayDefs.cacheTime < cacheTTL);
    }

    if (displayDefs && isFresh) {
      resolve(displayDefs);
    } else {
      fetchDisplayDefinitions().then((result) => {
        const fetchedDisplayDefs = result;
        fetchedDisplayDefs.cacheTime = new Date().getTime();
        localStorage.setItem('display', JSON.stringify(fetchedDisplayDefs));
        resolve(fetchedDisplayDefs);
      }, (error) => {
        reject(error);
      });
    }
  });
}

function getValueByLang(item, propertyId, displayDefs, langCode) {
  // TODO: REMOVE FAKED CONTEXT, SHOULD BE PICKED UP FROM DISPLAYDEFS (see next line)
  // const context = displayDefs['@context'];
  const context = {
    "fresnel": "http://www.w3.org/2004/09/fresnel#",
      "skos": "http://www.w3.org/2004/02/skos/core#",
      "owl": "http://www.w3.org/2002/07/owl#",
      "@base": "https://id.kb.se/vocab/display",
      "@vocab": "https://id.kb.se/vocab/",
      "marc": "https://id.kb.se/marc/",
      "lensGroups": {"@id": "@graph", "@container": "@index"},
      "lenses": {"@reverse": "fresnel:group", "@container": "@index"},
      "showProperties": {"@id": "fresnel:showProperties", "@container": "@list", "@type": "@vocab"},
      "classLensDomain": {"@reverse": "displayLens", "@type": "@vocab"},
      "inverseOf": {"@id": "owl:inverseOf", "@type": "@vocab"},
      "labelByLang": {"@id": "label", "@container": "@language"},
      "commentByLang": {"@id": "comment", "@container": "@language"},
      "prefLabelByLang": {"@id": "prefLabel", "@container": "@language"},
      "altLabelByLang": {"@id": "altLabel", "@container": "@language"},
      "noteByLang": {"@id": "note", "@container": "@language"},
      "titleByLang": {"@id": "title", "@container": "@language"},
      "descriptionByLang": {"@id": "description", "@container": "@language"}
  };
  let translatedValue = item[propertyId];
  let byLangKey = '';
  for (const key in context) {
    if (context[key]['@id'] === propertyId) {
      byLangKey = key;
    }
  }
  if (item[byLangKey] && item[byLangKey][langCode]) {
    translatedValue = item[byLangKey][langCode];
  }
  return translatedValue;
}

export function getProperties(typeInput, level, displayDefs, settings) {
  if (!typeInput || typeof typeInput === 'undefined') {
    throw new Error('getProperties was called with an undefined type.');
  }
  if (_.isObject(typeInput) && !_.isArray(typeInput)) {
    throw new Error(
      'getProperties was called with an object as type parameter (should be a string or an array of strings).'
    );
  }
  const typeList = [].concat(typeInput);
  for (const type of typeList) {
    const lenses = displayDefs.lensGroups[level].lenses;
    let props = [];
    if (typeof lenses[type] !== 'undefined') {
      props = lenses[type].showProperties;
    }
    props = [].concat(props);
    _.remove(props, (x) => _.isObject(x));
    if (props.length > 0) {
      return props;
    }
  }
  return [];
}

export function getDisplayObject(item, level, displayDefs, linked, vocab, settings) {
  if (!item || typeof item === 'undefined') {
    throw new Error('getDisplayObject was called with an undefined object.');
  }
  if (!_.isObject(item)) {
    throw new Error('getDisplayObject was called with a non-object.');
  }
  let result = {};
  let trueItem = Object.assign({}, item);

  if (trueItem.hasOwnProperty('@id') && !trueItem.hasOwnProperty('@type')) {
    trueItem = EditUtil.getLinked(trueItem['@id'], linked);
    if (!trueItem.hasOwnProperty('@type') && trueItem.hasOwnProperty('@id')) {
      return { 'label': StringUtil.removeDomain(trueItem['@id'], settings.removableBaseUris) };
    }
  }

  // Get the list of properties we want to show
  let properties = getProperties(trueItem['@type'], level, displayDefs, settings);
  if (properties.length === 0) { // If none were found, traverse up inheritance tree
    const baseClasses = VocabUtil.getBaseClassesFromArray(trueItem['@type'], vocab, settings.vocabPfx);
    for (let i = 0; i < baseClasses.length; i++) {
      if (typeof baseClasses[i] !== 'undefined') {
        properties = getProperties(baseClasses[i].replace(settings.vocabPfx, ''), level, displayDefs, settings);
        if (properties.length > 0) {
          break;
        }
      }
    }
    if (properties.length === 0) {
      properties = getProperties('Resource', level, displayDefs, settings);
    }
  }

  if (level === 'cards') {
    properties = ['@type'].concat(properties);
  }

  for (let i = 0; i < properties.length; i++) {
    if (!_.isObject(properties[i])) {
      const valueOnItem = getValueByLang(trueItem, properties[i], displayDefs, settings.lang);
      // const valueOnItem = getValueByLang(properties[i], trueItem[properties[i]], displayDefs, settings.lang) || trueItem[properties[i]];
      if (typeof valueOnItem !== 'undefined') {
        let value = valueOnItem;
        if (_.isObject(value) && !_.isArray(value)) {
          value = getChip(value, displayDefs, linked, vocab, settings);
          // value = getDisplayObject(value, 'chips', displayDefs, linked, vocab, vocabPfx);
        } else if (_.isArray(value)) {
          const newArray = [];
          for (const arrayItem of value) {
            if (_.isObject(arrayItem)) {
              newArray.push(getChip(arrayItem, displayDefs, linked, vocab, settings));
            } else {
              newArray.push(arrayItem);
            }
          }
          value = newArray;
        }
        result[properties[i]] = value;
      } else if (properties.length < 3 && i === 0) {
        const rangeOfMissingProp = VocabUtil.getRange(properties[i], vocab, settings.vocabPfx);
        const expectedClassName = StringUtil.labelByLang(
          rangeOfMissingProp[0], // Get the first one just to show something
          settings.lang,
          vocab,
          settings.vocabPfx
        );
        result[properties[i]] = `Okänd ${expectedClassName.toLowerCase()}`;
      }
    }
  }
  if (_.isEmpty(result)) {
    result = { 'label': 'Unknown' };
  }
  return result;
}

function extractStrings(obj) {
  let label = '';
  _.each(obj, (value, key) => {
    if (!_.isObject(value)) {
      label += value;
    } else {
      label += extractStrings(value);
    }
    label += ' ';
  });
  return label;
}

export function getChip(item, displayDefs, linked, vocab, settings) {
  const displayObject = getDisplayObject(item, 'chips', displayDefs, linked, vocab, settings);
  const rendered = extractStrings(displayObject);
  return rendered;
}

export function getCard(item, displayDefs, linked, vocab, settings) {
  return getDisplayObject(item, 'cards', displayDefs, linked, vocab, settings);
}
