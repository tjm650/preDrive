export function assertProductionBuildSafety(config:{environment:string;includeDeveloperTools:boolean;includeMockAdapter:boolean}):void{
 if(config.environment!=="production")return;
 if(config.includeDeveloperTools)throw new Error("Developer tools must not be included in production builds.");
 if(config.includeMockAdapter)throw new Error("Mock adapters must not be included in production builds.");
}
