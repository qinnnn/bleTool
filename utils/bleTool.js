const XpP323b = {
	oneWriteData: 50
}
export default class BleTool {
	constructor(e) {
		let that = this;
		//记录自身，防止某些函数this指向问题
		this.self = this;
		//全局app
		this.app = e;
		//服务搜索的获取
		this.mainService = "49535343-FE7D-4AE5-8FA9-9FAFD205E455"; //FE7D 73AE 
		// 蓝牙是否已初始化
		this.initState = false;
		//唯一控制
		this.onlyOne = false;
		//用户操作蓝牙之前，不进行蓝牙相关提示
		this.silence = true;
		//当前蓝牙开启状态
		this.available = false;
		//当前连接的设备id
		this.connectId = null;
		//当前连接的设备名
		this.connectName = '';
		//蓝牙特征值对应服务的 uuid
		this.mainServiceId = null;
		//连接失败重连总次数
		this.reconnectAll = 2;
		//连接失败重连当前次数
		this.reconnect = 0;

		//蓝牙搜索状态
		this.searchState = false;
		//蓝牙是否连接
		this.connectState = false;
		//蓝牙搜索总次数
		this.getDeviceAllTime = 3;
		//蓝牙搜索当前次数
		this.getDeviceTime = 0;
		//蓝牙搜索的定时器状态
		this.deviceTimer = null;
		//存储当前用户信息，是否要打开定位什么的
		this.systemInfo = {};
		//缓存中的已连接过的设备
		this.storageDeviceList = [];
		//已搜索到的缓存中的设备
		this.currtStorageDeviceList = [];
		//已搜索到的设备列表
		this.searchDeviceList = [];
		//读取用特征值
		this.readUuid = null;
		//写入用特征值
		this.writeUuid = null;
		//更新用特征值
		this.notifyUuid = null;
		//表明用特征值
		this.indicateUuid = null;
		//一次写入的最大数量
		this.oneTimeData = 50;
		//每次写入的间隔时间
		this.writeWaitTime = 5000;
		//当前写入的总次数
		this.looptime = 0;
		//最后一次写入的数据
		this.lastData = 0;
		//当前写入的次数
		this.currentTime = 1;
		//打印张数
		this.printNum = 1;
		//当前打印张数
		this.currentPrint = 1;

		//初始化蓝牙设备
		// this.openBLEAdapter(function() {
		// 	that.listenAdapterStateChange();
		// 	that.listenConnection();
		// });
	}
	//初始化蓝牙
	init() {
		let that = this;
		console.log("初始化蓝牙");
		//初始化蓝牙设备
		if (!this.initState) {
			this.openBLEAdapter(function() {
				that.listenAdapterStateChange();
				that.listenConnection();
			});
		} else {
			console.log("已初始化过，无需重复初始化");
		}
		let bleToolList = uni.getStorageSync('bleToolList');
		console.log("获取Storage：", bleToolList);
		if (bleToolList) {
			this.storageDeviceList = bleToolList;
		}
	}
	//获取蓝牙状态
	getBleState(callback = () => {}) {
		let that = this;
		this.silence = false;
		uni.getBluetoothAdapterState({
			success: function(res) {
				console.log("主动获取当前蓝牙状态-是否可用:", res.available, "是否搜索:", res.discovering);
				that.searchState = res.discovering
				if (res.available) {
					that.checkAvailable({
						toast: true
					}, res.available);
					callback(true);
				} else {
					uni.showToast({
						title: '请打开蓝牙后重试',
						icon: 'none'
					})
					callback(false);
				}
			},
			fail: function(res) {
				console.log("蓝牙适配器状态失败：", res)
				uni.showToast({
					title: '请打开蓝牙后重试',
					icon: 'none'
				})
				callback(false);
			}
		})
	}
	//搜索蓝牙
	search(callback = () => {}) {
		let that = this;
		this.silence = false;
		//开始进行搜索
		if (!this.available) {
			that.getBleState((callbacks) => {
				if (!callbacks) {
					callback(false);
					return false;
				}
			});
			// callback(false);
			// return false;
		}
		if (that.searchState) {
			console.log("已经有在搜索了，结束上一次的搜索")
			that.stopSearchDevice();
		}
		console.log("信息", that.systemInfo)
		if (that.systemInfo !== {}) {
			that.systemInfo = uni.getSystemInfoSync();
		}
		let platform = that.systemInfo.platform;
		if (platform == 'ios') {
			that.startSearchDevice(callback);
		} else if (platform == 'android') {
			let system = that.systemInfo.system;
			let system_no = system.replace('android', '');
			system_no = system.replace('Android', '');
			console.log("android版本", system_no);
			//android 6.0以上需授权地理位置权限
			if (Number(system_no) > 5) {
				uni.getSetting({
					success: function(res) {
						console.log("getSetting", res);
						if (!res.authSetting['scope.userLocation']) {
							uni.authorize({
								scope: 'scope.userLocation',
								complete: function(res) {
									that.startSearchDevice(callback);
								}
							});
						} else {
							that.startSearchDevice(callback);
						}
					},
					fail: function(res) {
						callback(false);
					}
				});
			} else {
				that.startSearchDevice(callback);
			}
		} else {
			console.log("不知道什么鬼的机型", that.systemInfo)
			that.startSearchDevice(callback);
		}
	}
	//搜索
	startSearchDevice(callback = () => {}) {
		let that = this;
		that.startBluetoothDevices(callback);
		console.log('筛选蓝牙设备 start');
		if (that.deviceTimer) {
			clearInterval(that.deviceTimer);
			that.deviceTimer = null;
		}
		that.deviceTimer = setInterval(() => {
			that.wechatGetDevice();
			if (that.getDeviceTime >= that.getDeviceAllTime) {
				that.stopSearchDevice();
				callback({
					'deviceList': that.searchDeviceList,
					'storageList': that.currtStorageDeviceList
				})
				return false;
			}
			that.getDeviceTime++;
		}, 2000)
	}
	//搜索监听
	wechatGetDevice(callback = () => {}) {
		let that = this;
		console.log('第', that.getDeviceTime, '次搜索设备');
		uni.getBluetoothDevices({
			success: function(res) {
				console.log("筛选蓝牙设备成功", res);
				let devices = [];
				let storageDevice = [];
				let num = 0;
				for (let i = 0; i < res.devices.length; i++) {
					if (res.devices[i].name != '未知设备') {
						devices[num] = res.devices[i];
						//判断是否为已连接过的设备
						// for (let y = 0; y < that.storageDeviceList.length; y++) {
						// 	if (res.devices[i].deviceId === that.storageDeviceList[y].deviceId) {
						// 		storageDevice.push(res.devices[i]);
						// 	}
						// }
						num++;
					}
				}
				console.log("判断是否已经连接过了设备", that.storageDeviceList)
				that.searchDeviceList = devices;
				that.currtStorageDeviceList = that.storageDeviceList;
				callback({
					'deviceList': that.searchDeviceList,
					'storageList': that.currtStorageDeviceList
				})
			},
			fail: function(res) {
				console.log("筛选蓝牙设备报错", res);
			},
		})
	}
	//搜索触发开始
	startBluetoothDevices(callback = () => {}) {
		let that = this;
		if (this.available) {
			if (!this.searchState) {
				console.log("搜索触发开始")
				uni.startBluetoothDevicesDiscovery({
					// services: [MainService],
					success: function(res) {
						that.searchState = true;
						console.log("成功,开始搜索: ", res)
						uni.showLoading({
							title: '搜索中，请稍后'
						})
					},
					fail: function(res) {
						that.available = false
						that.searchState = false;
						console.log("开启搜索失败: ", res)
						that.connectstate = false
						uni.showToast({
							title: '开启搜索失败',
							icon: 'none'
						})
						callback(false);
					}
				})
			} else {
				console.log("搜索时未开启蓝牙", this.available)
				callback(false);
			}
		} else {
			console.log("搜索时未开启蓝牙", this.available)
			uni.showToast({
				title: '请打开蓝牙',
				icon: 'none'
			})
			callback(false);
		}
	}
	//停止搜索
	stopSearchDevice() {
		console.log("停止搜索开始")
		uni.hideLoading();
		let that = this;
		that.getDeviceTime = 0;
		if (that.deviceTimer) {
			clearInterval(that.deviceTimer);
			that.deviceTimer = null;
		}
		uni.stopBluetoothDevicesDiscovery({
			success: function(res) {
				that.searchState = false;
				console.log("停止搜索")
			},
			fail: function(res) {
				console.log("停止搜索失败")
			}
		})
	}
	//监听蓝牙适配器状态
	listenAdapterStateChange() {
		let that = this;
		console.log("监听蓝牙适配器状态")
		uni.onBluetoothAdapterStateChange(function(res) {
			console.log("当前蓝牙状态-是否可用:", res.available, "是否搜索:", res.discovering)
			that.searchState = res.discovering
			that.checkAvailable({
				toast: true
			}, res.available);
		})
	}
	//监听蓝牙连接状态
	listenConnection() {
		let that = this;
		console.log("监听蓝牙连接状态")
		uni.onBLEConnectionStateChange(function(res) {
			console.log("connectState", res.connected);
			that.connectState = res.connected;
			if (res.connected) {
				uni.showToast({
					title: '连接成功',
				})
			} else {
				console.log("蓝牙状态", that.available, false)
				uni.showToast({
					title: '连接已断开',
					icon: 'none'
				})
			}
		})
	}
	//检查蓝牙适配器
	checkAvailable(opt, available) {
		let that = this;
		if (typeof available == "boolean") {
			that.available = available;
		}
		console.log("蓝牙适配器检查", that.available, available);
		if (!that.available && opt.toast) {
			console.log("请打开蓝牙")
			if (!that.silence) {
				uni.showToast({
					title: '请打开蓝牙',
					icon: 'none'
				})
			}
		}
		return that.available;
	}
	//打开蓝牙
	openBLEAdapter(callback = () => {}) {
		let that = this
		console.log("初始化打开蓝牙")
		this.initState = true;
		uni.openBluetoothAdapter({
			success: function(res) {
				console.log('打开蓝牙成功')
				that.checkAvailable({
					toast: true
				}, true)
				if (!that.silence) {
					uni.showToast({
						title: '开启蓝牙成功',
					})
				}
				callback();
			},
			fail: function(res) {
				console.log('打开蓝牙失败', res)
				that.checkAvailable({
					toast: true
				}, false)
			}
		})
	}
	// 连接设备
	connectDevice(item, callback = () => {}) {
		let that = this;
		console.log("准备连接设备", item, item.deviceId)
		if (!item.deviceId) {
			uni.showToast({
				title: '设备ID不可空',
				icon: 'none'
			})
			callback(false)
			return false;
		}
		if (that.connectId && that.connectId === item.deviceId) {
			uni.showToast({
				title: '请勿重复连接',
			})
			callback(true);
			return false;
		}
		if (that.connectState) {
			uni.showModal({
				title: '温馨提示',
				content: '当前已有连接的设备，是否断开之前的连接？',
				success: function(res) {
					if (res.confirm) {
						console.log('连接用户点击确定');
						that.cancelBleConnect(() => {
							that.connectId = item.deviceId;
							that.connectName = item.name;
							that.reconnect = 0;
							that.connectDeviceStart(item, '连接中', callback);
						})
					} else if (res.cancel) {
						console.log('连接用户点击取消');
						callback(false);
					}
				}
			})
		} else {
			that.connectId = item.deviceId;
			that.connectName = item.name;
			that.mainServiceId = null;
			that.reconnect = 0;
			that.connectDeviceStart(item, '连接中', callback);
		}
	}
	//连接进行
	connectDeviceStart(item, msg, callback = () => {}) {
		let that = this;
		if (item.deviceId) {
			uni.showToast({
				title: '设备ID不可空',
				icon: 'none'
			})
			callback(false)
		}
		uni.showLoading({
			title: msg
		})
		uni.createBLEConnection({
			deviceId: that.connectId,
			success: function(res) {
				console.log("连接成功", res)
				uni.showToast({
					title: '连接成功',
				})
				that.connectState = true;
				that.searchService(callback);
				console.log("保存Storage");
				let setStorageState = true;
				for (let i = 0; i < that.storageDeviceList.length; i++) {
					if (that.storageDeviceList[i].deviceId === that.connectId) {
						setStorageState = false;
					}
				}
				if (setStorageState) {
					that.storageDeviceList.push(item);
					console.log("已保存Storage", that.storageDeviceList);
					uni.setStorage({
						key: 'bleToolList',
						data: that.storageDeviceList
					});
				}
			},
			fail: function(res) {
				console.log("连接失败", res)
				that.connectState = false;
				if (!that.available) {
					uni.showToast({
						title: '请打开蓝牙',
						icon: 'none'
					})
					callback(false)
				} else {
					if (that.reconnectAll - that.reconnect > 0) {
						uni.showToast({
							title: '连接失败',
							icon: 'none'
						})
						that.reconnect++;
						console.log("第", that.reconnect, "次重连");
						setTimeout(function() {
							that.connectDeviceStart(item, "重连中", callback);
						}, 800);
					} else {
						uni.showToast({
							title: '重连失败',
							icon: 'none'
						})
						callback(false)
						uni.showModal({
							title: '温馨提示',
							content: '请确认设备正常通电，或重新打开蓝牙后重试',
							success: function(res) {
								if (res.confirm) {
									console.log('连接失败用户点击确定');
								} else if (res.cancel) {
									console.log('连接失败用户点击取消');
								}
							}
						})
					}
				}
			}
		})
	}
	//搜索服务
	searchService(callback = function() {}) {
		console.log("搜索服务")
		let that = this;
		uni.showLoading({
			title: "数据处理中"
		})
		uni.getBLEDeviceServices({
			//服务uid
			deviceId: that.connectId,
			success: function(res) {
				console.log("搜索服务成功", res)
				for (let i = 0; i < res.services.length; i++) {
					let rs = res.services[i]
					// "49535343-FE7D-4AE5-8FA9-9FAFD205E455"
					// "000018F0-0000-1000-8000-00805F9B34FB"
					// "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2" //啥都没搜出来，好像没啥用
					// "0000180A-0000-1000-8000-00805F9B34FB" //设备信息
					// "00001800-0000-1000-8000-00805F9B34FB" //同意访问
					// "00001801-0000-1000-8000-00805F9B34FB" //普通属性
					// if (rs.uuid.indexOf(that.mainService) > -1) {
					if (i == 0) {
						console.log('找到匹配服务', res.services[i].uuid)
						that.mainServiceId = res.services[i].uuid;
						that.characteristic(callback)
						return;
					}
				}
				console.log("无匹配服务")
				callback(false)
			},
			fail: function() {
				uni.hideLoading();
				uni.showToast({
					title: '搜索服务失败',
					icon: 'none'
				})
				callback(false)
			}
		})
	}
	/**
	 * 特征值获取
	 */
	characteristic(callback = function() {}) {
		console.log("特征值获取")
		let that = this
		uni.getBLEDeviceCharacteristics({
			deviceId: that.connectId,
			serviceId: that.mainServiceId,
			success: function(res) {
				console.log("特征id:", res)
				that.readUuid = null;
				that.writeUuid = null;
				that.notifyUuid = null;
				that.indicateUuid = null;
				for (let i = 0; i < res.characteristics.length; i++) { //写入的特征值
					let ct = res.characteristics[i]
					if (ct.properties.notify) {
						console.log('找到更新匹配特征', ct.uuid)
						that.notifyUuid = ct.uuid;
						that.openNotify();
					}
					if (ct.properties.write) {
						console.log('找到写匹配特征', ct.uuid)
						that.writeUuid = ct.uuid;
					}
					if (ct.properties.read) {
						console.log('找到读匹配特征', ct.uuid)
						that.readUuid = ct.uuid
					}
					if (ct.properties.indicate) {
						console.log('找到表明匹配特征', ct.uuid)
						that.indicateUuid = ct.uuid
					}
				}
				uni.showToast({
					title: '数据处理完成'
				})
				callback(true);
			},
			fail: function(res) {
				console.log('找不到特征值', res);
				uni.hideLoading();
				uni.showToast({
					title: '找不到特征值',
					icon: 'none'
				})
				callback(false)
			}
		})
	}
	//读取设备状态
	readDeviceState(callback = function() {}) {
		let that = this;
		console.log(读取设备状态)
		uni.readBLECharacteristicValue({
			deviceId: that.connectId,
			serviceId: that.mainServiceId,
			characteristicId: that.readUuid,
			success: function(res) {
				console.log('readBLECharacteristicValue:', res.errCode);
				callback(res.errCode);
			},
			fail: function(res) {
				console.log('readBLECharacteristicValue:', res.errCode);
				callback(res.errCode);
			}
		})
	}
	//打开订阅
	openNotify() {
		var that = this
		console.log("打开订阅 openNotify", that.connectId, that.mainServiceId, that.notifyUuid)
		uni.notifyBLECharacteristicValueChange({
			deviceId: that.connectId,
			serviceId: that.mainServiceId,
			characteristicId: that.notifyUuid,
			state: true,
			success: function(res) {
				console.log("notify打开成功", res)
				that.listenNotifyValueChange();
			},
			fail: function(res) {
				console.log("notify打开失败", res);
				uni.showToast({
					title: '订阅打开失败',
					icon: 'none'
				})
			},
		})
	}
	// 监听特征值变化
	listenNotifyValueChange() {
		let that = this
		console.log("监听特征变化")
		uni.onBLECharacteristicValueChange(function(res) {
			console.log("收到数据")
			let value = res.value
			console.log(value);
			let value2 = that.uint8Array2Str(value)
			console.log("returnstr", value2)
			let dataView = new DataView(that.string2Buffer(value2))
		})
	}
	//断开蓝牙连接
	cancelBleConnect(callback = function() {}) {
		let that = this;
		console.log("断开连接")
		if (that.connectState) {
			uni.closeBLEConnection({
				deviceId: that.connectId,
				success: function(res) {
					console.log("断开连接成功")
					uni.showToast({
						title: '断开连接成功',
					})
					that.connectState = false;
					that.connectId = '';
					that.connectName = '';
					callback(true);
				},
				fail: function(res) {
					console.log("断开连接失败")
					that.connectState = false;
					that.connectId = '';
					that.connectName = '';
					callback(false);
				}
			})
		}
	}
	//多次写入
	writeCharacteristicList(buff, callback = function() {}) {
		let that = this;
		console.log("多次写入开始", buff);
		uni.showLoading({
			title: "数据写入中"
		})
		var time = that.oneTimeData;
		var looptime = parseInt(buff.length / time);
		var lastData = parseInt(buff.length % time);
		console.log(looptime + '---' + lastData);
		that.looptime = looptime + 1;
		that.lastData = lastData;
		that.currentTime = 1
		console.log('准备批量写入,写入总次数' + that.loopNumData + '最后一次写入数据' + that.lastData);
		that.writeCharacteristicSend(buff, callback);
	}
	//多次写入执行
	writeCharacteristicSend(buff, callback = function() {}) {
		let that = this;
		console.log("多次写入执行");
		var currentTime = that.currentTime;
		var loopTime = that.looptime;
		var lastData = that.lastData;
		var onTimeData = that.oneTimeData;
		var printNum = that.printNum; //打印多少份
		var currentPrint = that.currentPrint;
		var buf;
		var dataView;
		if (currentTime < loopTime) {
			buf = new ArrayBuffer(onTimeData);
			dataView = new DataView(buf);
			for (var i = 0; i < onTimeData; ++i) {
				dataView.setUint8(i, buff[(currentTime - 1) * onTimeData + i]);
			}
		} else {
			buf = new ArrayBuffer(lastData);
			dataView = new DataView(buf);
			for (var i = 0; i < lastData; ++i) {
				dataView.setUint8(i, buff[(currentTime - 1) * onTimeData + i]);
			}
		}
		console.log('第' + currentTime + '次发送数据大小为：' + buf.byteLength);
		console.log('deviceId:' + that.connectId);
		console.log('serviceId:' + that.mainServiceId);
		console.log('characteristicId:' + that.writeUuid);

		uni.writeBLECharacteristicValue({
			deviceId: that.connectId,
			serviceId: that.mainServiceId,
			characteristicId: that.writeUuid,
			value: buf,
			success: function(res) {
				console.log('写入成功', res);
			},
			fail: function(e) {
				console.error('写入失败', e);
				callback(false)
			},
			complete: function() {
				currentTime++;
				if (currentTime <= loopTime) {
					that.currentTime = currentTime
					that.writeCharacteristicSend(buff, callback);
				} else {
					uni.showToast({
						title: '已打印第' + currentPrint + '张'
					});
					if (currentPrint == printNum) {
						that.looptime = 0;
						that.lastData = 0;
						that.currentTime = 1;
						that.isReceiptSend = false;
						that.isLabelSend = false;
						that.currentPrint = 1;
						uni.showToast({
							title: '写入已完成',
							icon: "success"
						})
						callback(true)
					} else {
						currentPrint++;
						that.currentPrint = currentPrint;
						that.currentTime = 1
						console.log('开始打印');
						that.writeCharacteristicSend(buff, callback);
					}
				}
			}
		});
	}
	//写入数据
	writeCharacteristicValue(buff, callback = function() {}) {
		console.log("准备写入数据", buff)
		let that = this;
		console.log(that.connectId, that.mainServiceId, that.writeUuid, buff);
		if (that.connectId && that.mainServiceId && that.writeUuid) {
			uni.writeBLECharacteristicValue({
				deviceId: that.connectId,
				serviceId: that.mainServiceId,
				characteristicId: that.writeUuid,
				// value: that.string2Buffer(str),
				value: buff,
				success: function(res) {
					// uni.showToast({
					// 	title: '写入成功',
					// })
					callback(true)
					console.log("writeDate-->", res);
				},
				fail: function(res) {
					console.log("写入失败", res)
					uni.showToast({
						title: '写入失败',
						icon: "none"
					})
					callback(false)
					that.connectstate = false
				}
			})
		} else {
			uni.showToast({
				title: '数据不足',
				icon: "none"
			})
			that.connectstate = false;
			callback(false)
		}

	}
	//16进制字符串转整形数组
	str2Bytes(str) {
		var len = str.length;
		if (len % 2 != 0) {
			return null;
		}
		var hexA = new Array();
		for (var i = 0; i < len; i += 2) {
			var s = str.substr(i, 2);
			var v = parseInt(s, 16);
			hexA.push(v);
		}
		return hexA;
	}
	//整形数组转buffer
	array2Buffer(arr) {
		let buffer = new ArrayBuffer(arr.length)
		let dataView = new DataView(buffer)
		for (let i = 0; i < arr.length; i++) {
			dataView.setUint8(i, arr[i])
		}
		return buffer
	}
	//整形数组转buffer
	string2Buffer(str) {
		let arr = this.str2Bytes(str);
		return this.array2Buffer(arr)
	}
	//ArrayBuffer转十六进制字符串
	uint8Array2Str(buffer) {
		var str = "";
		let dataView = new DataView(buffer)
		for (let i = 0; i < dataView.byteLength; i++) {
			var tmp = dataView.getUint8(i).toString(16)
			if (tmp.length == 1) {
				tmp = "0" + tmp
			}
			str += tmp
		}
		return str;
	}
	//十六进制倒序,非十六进制返回空
	reverse16(str16) {
		var strarr = (str16 + "").split("");
		if (strarr.length % 2 == 0) {
			var s = new Array();
			for (var i = strarr.length - 1; i > 0; i = i - 2) {
				s.push(strarr[i - 1]);
				s.push(str16[i]);
			}
			var str = s.join("");
			return str;
		}
		return "";
	}
}
