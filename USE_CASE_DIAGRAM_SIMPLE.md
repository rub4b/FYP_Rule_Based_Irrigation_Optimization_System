flowchart LR
    %% Actors
    Farmer([Farmer])
    Admin([Admin])
    User([👤 User])
    
    %% Generalization relationships
    Farmer -.-> User
    Admin -.-> User
    
    %% System Boundary
    subgraph AQUAMETIC["AQUAMETIC System"]
        direction TB
        
        subgraph AUTH[" "]
            LOGIN(Login)
            SIGNUP(Sign up)
            FORGOT(Forgot password)
            RESET(Reset password)
            PROFILE(Manage profile)
        end
        
        subgraph PLOT[" "]
            DASHBOARD(View dashboard)
            PLOTS(Manage plots)
            MAP(View plot on map)
            EDITPLOT(Add/Edit plot details)
        end
        
        subgraph MONITOR[" "]
            REALTIME(View real-time<br/>moisture data)
            MANUAL(Manually input<br/>moisture data)
            SENSORSTAT(Monitor sensor status)
            ALERTS(Receive alerts)
        end
        
        subgraph IRR[" "]
            RECOMMEND(Receive irrigation<br/>recommendation)
            WEATHER_UC(Fetch weather<br/>forecast)
            CALCULATE(Calculate water<br/>requirement)
            LOGIRR(Log irrigation<br/>activity)
        end
        
        subgraph ANALYT[" "]
            ANALYTICS(View cost savings<br/>analytics)
            HISTORY(View historical<br/>data)
            REPORTS(Generate reports)
            EXPORT(Export data)
        end
        
        subgraph ADM[" "]
            MGFARMERS(Manage farmers)
            ALLPLOTS(View all plots<br/>& sensors)
            HEALTH(Monitor system<br/>health)
            SETTINGS(Configure system<br/>settings)
            LOGS(View system logs)
        end
        
        subgraph DATA[" "]
            PUBLISH(Publish sensor data via MQTT)
            SUBSCRIBE(Subscribe to sensor updates)
        end
    end
    
    %% External Systems
    IoT([IoT Sensor<br/>Network])
    Weather([Open-Meteo<br/>API])
    
    %% User connections
    User --> LOGIN
    User --> SIGNUP
    User --> FORGOT
    User --> DASHBOARD
    User --> PROFILE
    User --> PLOTS
    User --> REALTIME
    User --> MANUAL
    User --> ALERTS
    User --> RECOMMEND
    User --> LOGIRR
    User --> ANALYTICS
    User --> HISTORY
    User --> REPORTS
    User --> EXPORT
    User --> MGFARMERS
    User --> ALLPLOTS
    User --> HEALTH
    User --> SETTINGS
    User --> LOGS
    
    %% External system connections
    AQUAMETIC -.-> IoT
    AQUAMETIC -.-> Weather
    PUBLISH -.->|sensor data| IoT
    REALTIME -.->|sensor data| IoT
    WEATHER_UC -.->|forecast| Weather
    
    %% Use case relationships
    FORGOT -.->|include| RESET
    PLOTS -.->|include| EDITPLOT
    PLOTS -.->|include| MAP
    REALTIME -.->|include| SUBSCRIBE
    MANUAL -.->|extend<br/>if sensor fails| REALTIME
    SENSORSTAT -.->|extend| REALTIME
    ALERTS -.->|include| SUBSCRIBE
    RECOMMEND -.->|include| REALTIME
    RECOMMEND -.->|include| WEATHER_UC
    RECOMMEND -.->|include| CALCULATE
    
    %% Styling
    classDef actorStyle fill:#fff,stroke:#333,stroke-width:3px
    classDef ucStyle fill:#fff,stroke:#333,stroke-width:2px
    classDef adminUC fill:#ffe6e6,stroke:#cc0000,stroke-width:2px
    classDef externalStyle fill:#f0f0f0,stroke:#666,stroke-width:2px,stroke-dasharray: 5 5
    
    class Farmer,Admin,User actorStyle
    class LOGIN,SIGNUP,FORGOT,RESET,DASHBOARD,PROFILE,PLOTS,MAP,EDITPLOT,REALTIME,MANUAL,SENSORSTAT,ALERTS,RECOMMEND,WEATHER_UC,CALCULATE,LOGIRR,ANALYTICS,HISTORY,REPORTS,EXPORT,PUBLISH,SUBSCRIBE ucStyle
    class MGFARMERS,ALLPLOTS,HEALTH,SETTINGS,LOGS adminUC
    class IoT,Weather externalStyle
