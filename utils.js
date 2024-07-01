function getPublicPath() {
 return process.env.APP_DEV ? './extraResources/' : process.resourcesPath + '/extraResources/'
}

module.exports = {getPublicPath}
