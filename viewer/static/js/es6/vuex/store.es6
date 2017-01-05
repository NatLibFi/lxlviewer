import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

const state = {
  editor: {
    data: {},
  },
  vocab: {},
  display: {},
  settings: {},
  status: {
    lastAdded: '',
    level: 'it',
    dirty: true,
    isDev: false,
    saved: {
      loading: false,
      error: false,
      info: '',
    },
  },
};

const mutations = {
  SYNCPOST (state, data) {
    state.editor.data = data;
  },
  UPDATE_FORM (state, form, data) {
    state.editor.data[form] = data;
  },
  LOADVOCAB (state, data) {
    state.vocab = data;
  },
  LOADDISPLAYDEFS (state, data) {
    state.display = data;
  },
  CHANGESETTINGS (state, data) {
    state.settings = data;
  },
  CHANGESAVEDSTATUS (state, property, data) {
    state.saved[property] = data;
  },
};

export default new Vuex.Store({
  state,
  mutations,
});
