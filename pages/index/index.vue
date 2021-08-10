<template>
	<view class="layout flexs flex-v">
		<scroll-view :enable-flex="true" :scroll-y="true" class="layout-content">
			<view class="layout-content-hr"></view>
			<view class="layout-cont">
				<view>
					<view v-show="!connectState" class="modal-box">
						<view class="modal-title">
							<view class="modal-title-around"></view>
							已连接过设备
						</view>
						<view class="modal-cont">
							<view class="ble-box" v-for="(item, key) in storageList" :key="key" @click="connectBle(item)">
								<view class="ble-name">{{ item.name }}</view>
								<view class="ble-device">{{ item.deviceId }}</view>
								<view v-if="item.lineState" class="ble-compatible">可使用</view>
							</view>
							<view class="ble-none" v-if="storageList.length == 0">暂无设备</view>
						</view>
					</view>
					<view v-show="!connectState" class="modal-box">
						<view class="modal-title">
							<view class="modal-title-around"></view>
							其他设备
						</view>
						<view class="modal-cont">
							<view class="ble-box" v-for="(item, key) in devicesList" :key="key" @click="connectBle(item)">
								<view class="ble-name">{{ item.name }}</view>
								<view class="ble-device">{{ item.deviceId }}</view>
								<view v-if="item.lineState" class="ble-compatible">可使用</view>
							</view>
							<view class="ble-none" v-if="devicesList.length == 0">暂无设备</view>
						</view>
					</view>
					<view v-show="connectState" class="modal-box">
						<view class="modal-cont">
							<view class="ble-title">已连接成功，请输入内容进行写入尝试</view>
							<input class="ble-input" v-model="inputValue" placeholder="请输入内容进行写入尝试" />
							<canvas canvas-id="edit_area_canvas"></canvas>
						</view>
					</view>
					<button class="zbw-btn" hover-class="zbw-btn-hover" @click="blueStart">
						{{ searchState || searchStateOne ? (searchStateOne && !searchState ? '重新搜索' : '搜索中') : '搜索附近蓝牙设备' }}
					</button>
					<button v-show="searchState" class="zbw-btn zbw-btn-error" hover-class="zbw-btn-error-hover" @click="blueStopSearch">停止搜索</button>
					<button v-show="connectState" class="zbw-btn" hover-class="zbw-btn-hover" @click="writeValue">尝试写入数据</button>
					<button v-show="connectState" class="zbw-btn zbw-btn-error" hover-class="zbw-btn-error-hover" @click="disconnect">断开连接</button>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				searchState: false,
				searchStateOne: false,
				connectState: false,
				inputValue: '',
				devicesList: [],
				storageList: [],
				canvasWidth: 80,
				canvasHeight: 80
			}
		},
		onLoad() {

		},
		onLoad() {
			this.BleTool.init();
		},
		methods: {
			//断开连接
			disconnect: function() {
				let that = this;
				this.BleTool.cancelBleConnect(() => {
					that.connectState = false;
				});
			},
			blueStart: function() {
				let that = this;
				this.searchStateOne = true;
				if (that.searchState) {
					uni.showToast({
						title: '搜索中，请稍后',
						icon: 'none'
					});
					return false;
				}
				this.BleTool.getBleState(state => {
					if (state) {
						that.searchState = true;
						that.BleTool.search(callback => {
							console.log('回调callback', callback);
							if (callback) {
								uni.showToast({
									title: '搜索完成',
									icon: 'none'
								});
								for (let i in callback.deviceList) {
									for (let y in that.modalList) {
										if (callback.deviceList[i].name.indexOf(that.modalList[y].value) != -1) {
											callback.deviceList[i].lineState = true;
										}
									}
								}
								that.$nextTick(() => {
									that.devicesList = callback.deviceList;
									that.storageList = callback.storageList;
								});
							}
							that.searchState = false;
						});
					} else {
						that.searchState = false;
					}
				});
			},
			blueStopSearch: function() {
				this.BleTool.stopSearchDevice();
				this.searchState = false;
			},
			connectBle: function(item) {
				let that = this;
				this.BleTool.connectDevice(item, callback => {
					console.log('连接的回调callback', callback);
					if (callback) {
						that.connectState = true;
					} else {
						that.connectState = false;
					}
				});
			},
			writeValue: function() {
				let that = this;
				that.BleTool.writeCharacteristicList(this.inputValue, callback => {
					console.log('writeValue输入的回调callback', callback);
					if (callback) {
						uni.showToast({
							title: '写入成功'
						});
					}
				});
			}
		}
	}
</script>

<style scoped>
.ble-box {
	width: 100%;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	padding-bottom: 12rpx;
	padding-top: 12rpx;
	border-bottom: 2rpx solid #eee;
	position: relative;
}
.ble-compatible {
	position: absolute;
	right: 6rpx;
	top: 50%;
	transform: translate(0, -50%);
	color: #0abbbb;
}
.ble-list {
	width: 100%;
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	padding-bottom: 16rpx;
	padding-top: 16rpx;
}
.ble-name {
	color: #333;
	font-size: 32rpx;
}
.ble-device {
	margin-top: 8rpx;
	color: #666;
	font-size: 28rpx;
}
.ble-none {
	padding-bottom: 24rpx;
	padding-top: 24rpx;
}
.zbw-btn {
	margin-top: 24rpx;
}
.ble-title {
	padding-top: 24rpx;
	padding-bottom: 24rpx;
	width: 100%;
	font-size: 32rpx;
	font-weight: bold;
}
.ble-input {
	border-radius: 16rpx;
	width: 100%;
	height: 80rpx;
	line-height: 80rpx;
	box-sizing: border-box;
	padding: 0 24rpx;
	color: #333;
	border-color: eee;
}
</style>
