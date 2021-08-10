import Vue from 'vue'
import App from './App'
import BleTool from './utils/bleTool.js'

Vue.config.productionTip = false

Vue.prototype.BleTool = new BleTool();

App.mpType = 'app'

const app = new Vue({
    ...App
})
app.$mount()
