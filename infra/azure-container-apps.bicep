@description('Azure region for the Container Apps environment.')
param location string = resourceGroup().location

@description('Name of the Azure Container Apps managed environment.')
param containerAppsEnvironmentName string

@description('Name of the public API Container App.')
param apiContainerAppName string = 'edusignal-api'

@description('Name of the internal worker Container App.')
param workerContainerAppName string = 'edusignal-worker'

@description('Azure Container Registry login server, for example myregistry.azurecr.io.')
param acrLoginServer string

@description('Azure Container Registry username.')
param acrUsername string

@secure()
@description('Azure Container Registry password.')
param acrPassword string

@description('Fully qualified API image name, including tag.')
param apiImage string

@description('Fully qualified worker image name, including tag.')
param workerImage string

@secure()
@description('PostgreSQL connection string.')
param databaseUrl string

@secure()
@description('Redis connection string.')
param redisUrl string

@secure()
@description('Bright Data API key.')
param brightdataApiKey string

@description('Bright Data zone.')
param brightdataZone string = 'serp_api3'

@secure()
@description('Gemini API key.')
param geminiApiKey string

@description('Comma-separated list of allowed frontend origins for CORS.')
param frontendOrigin string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${containerAppsEnvironmentName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiContainerAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acrPassword
        }
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'redis-url'
          value: redisUrl
        }
        {
          name: 'brightdata-api-key'
          value: brightdataApiKey
        }
        {
          name: 'gemini-api-key'
          value: geminiApiKey
        }
      ]
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'BRIGHTDATA_API_KEY'
              secretRef: 'brightdata-api-key'
            }
            {
              name: 'BRIGHTDATA_ZONE'
              value: brightdataZone
            }
            {
              name: 'GEMINI_API_KEY'
              secretRef: 'gemini-api-key'
            }
            {
              name: 'FRONTEND_ORIGIN'
              value: frontendOrigin
            }
          ]
        }
      ]
    }
  }
}

resource workerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: workerContainerAppName
  location: location
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: acrLoginServer
          username: acrUsername
          passwordSecretRef: 'acr-password'
        }
      ]
      secrets: [
        {
          name: 'acr-password'
          value: acrPassword
        }
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'redis-url'
          value: redisUrl
        }
        {
          name: 'brightdata-api-key'
          value: brightdataApiKey
        }
        {
          name: 'gemini-api-key'
          value: geminiApiKey
        }
      ]
    }
    template: {
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
      containers: [
        {
          name: 'worker'
          image: workerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'BRIGHTDATA_API_KEY'
              secretRef: 'brightdata-api-key'
            }
            {
              name: 'BRIGHTDATA_ZONE'
              value: brightdataZone
            }
            {
              name: 'GEMINI_API_KEY'
              secretRef: 'gemini-api-key'
            }
            {
              name: 'FRONTEND_ORIGIN'
              value: frontendOrigin
            }
          ]
        }
      ]
    }
  }
}

output apiUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
