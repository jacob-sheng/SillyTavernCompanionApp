const { withProjectBuildGradle } = require('@expo/config-plugins');
const block = `
// STC: keep native object paths within Ninja's Windows path limit.
subprojects { subproject ->
    afterEvaluate {
        if (subproject.plugins.hasPlugin('com.android.library') || subproject.plugins.hasPlugin('com.android.application')) {
            subproject.android.defaultConfig.externalNativeBuild.cmake.arguments '-DCMAKE_OBJECT_PATH_MAX=128'
            def ninja = System.getenv('STC_NINJA_PATH')
            if (ninja) subproject.android.defaultConfig.externalNativeBuild.cmake.arguments "-DCMAKE_MAKE_PROGRAM=" + ninja.replace('\\\\', '/')
        }
    }
}
`;
module.exports = config => withProjectBuildGradle(config, result => {
  if (!result.modResults.contents.includes('// STC: keep native object paths')) {
    result.modResults.contents = result.modResults.contents.replace('apply plugin: "expo-root-project"', block + '\napply plugin: "expo-root-project"');
  }
  return result;
});
