Digital Platform for efficient remote management of Antarctic research stations
Sources of Truth
The platform uses three primary DSL files to define the Antarctic research station’s digital twin:
hierarchy.twin — defines the component hierarchy and structural metadata.
connection.twin — defines connections between components and their validation rules.
spec.twin — defines component specifications, ratings, defaults, and sensor requirements.
These files are the authoritative source for the station model. They are compiled into JSON files that are consumed by the application and simulation engine.
1. hierarchy.twin
Purpose
hierarchy.twin is a domain-specific language (DSL) that defines which components belong inside which containers, along with each component’s type, priority, floor level, tags, backup designation, and optional external data reference.
1.1 Component hierarchy and syntax
A station is represented as a tree of nested component declarations.
For example:
Station:station @0 %critical {
    HVACBlock:block @0 {
        HeatingSystem:system @0 {
            MainConditioner:air_conditioner @0 %primary
            BackupConditioner:air_conditioner @0 backup(MainConditioner) %backup
        }

        VentilationSystem:system @1 {
            …
        }
    }
    GroundFloor:floor @level=0 @0 {
        EnergyBlock:block @1 {
            …
        }
    }
}
Each declaration identifies a component by its name and type. Nested declarations define the parent-child relationships within the station.
1.2 Supported container types
Only the following types are valid as containers:
campus
station
floor
block
system
The following structural constraints apply:
A station may be a root element or a child of a campus container.
A floor may only be contained within a station or block.
Every floor declaration must include an @level attribute followed by an integer.
A floor’s level defaults to 0 for non floor elements.
1.3 Supported internal component types
The following internal component types are supported:
sensor
antenna
generator
controller
tank
pump
storage
vent
alarm
server
vehicle
solar_panel
air_conditioner
These types represent leaf components or other non-container components within the hierarchy.
1.4 Component attributes and special keywords
A component declaration may include the following attributes and keywords.
Priority — @<integer>
Each declaration is followed by an @ attribute containing an integer priority.
Priority is evaluated within the component’s local scope.
Lower numbers indicate higher priority.
Multiple components within the same scope may share the same priority.
Tags — %<tag>
A component may be followed by one or more % tags.
Tags provide additional metadata about the component.
Example:
	MainConditioner:air_conditioner @0 %primary
Backup designation — backup(...)
The special backup keyword designates a component as a backup component for specific components(which are of the same type as the backup component).
Example:
	BackupConditioner:air_conditioner @0 backup(MainConditioner, Conditioner2) %backup
Here the BackupConditioner is the backup  for MainConditioner and Conditioner2
External reference — external@<field>
The special external keyword associates a component with a field defined in external.json. It must be followed by @ and a valid external field reference.
Example:
	UploadRouter:antenna external@network.up
In this example, the component references the network.up field in external.json.
Globally unique names
All component names in hierarchy.twin must be globally unique. No two components may share the same identifier, even if they belong to different containers.
1.5 Compilation output: hierarchy.json
The compiler converts hierarchy.twin into hierarchy.json, containing an entry for every declared component.
The output follows this structure:
[
  {
    "name": "ComponentName",
    "type": "ComponentType",
    "parent": "DirectParentName",
    "priority": 0,
    "floor": 0,
    "is_backup": false,
    “backup”: [
       “ComponentsToBackUp”
     ]
     "external_field": null,
     "children": [
       "ChildComponentName"
     ],
     "tags": [
      "tag_name"
    ]
  }
]
Each component entry contains:
name
	Globally unique component name.
type
	Component or container type.
parent
	Name of the component’s direct parent.
priority
	Priority within the component’s local scope.
floor
	Floor level on which the component is located; defaults to 0.
is_backup
	Boolean indicating whether the component is designated as a backup.
backup
	List of components that this component backs up(empty if is_backup=false).
external_field
	null if no external field is referenced; otherwise, the referenced field path, such as "network.up".
children
	Names of the component’s direct children.
tags
	List of tags assigned to the component.
The JSON output contains one entry for each component defined in hierarchy.twin.
2. connection.twin
Purpose
connection.twin defines the connections between components in the station. It specifies the source, target, connection type, and relationship represented by each connection.
2.1 Connection syntax
The basic syntax is:
	source_node:target_node[connection_type]@relation
For example:
	EnergyController:Generator1[signal]@energy_demand
This defines a signal connection from EnergyController to Generator1, with the relation energy_demand.
2.2 Supported connection types
The following four connection types are supported:
power
data
signal
resource
2.3 Connection validation rules
Connections must satisfy the following constraints:
General rules
A component cannot connect to itself. Self-connections are prohibited.
Sensor components
A component of type sensor:
Must only participate in data connections.
Must have exactly one incoming connection and exactly one outgoing connection.
Must have its single outgoing connection terminate at a component of type antenna.
Floor components
A component of type floor must not have any incoming or outgoing connections.
Controller components
A component of type controller may only participate in signal connections.
Alarm components
A component of type alarm:
Must have exactly one incoming signal connection.
Must not have any outgoing connections.
2.4 Compilation output: connection.json
The compiler converts connection.twin into connection.json.
Each connection is represented by an object with the following structure:
[
  {
    "source": "SourceComponentName",
    "target": "TargetComponentName",
    "type": "connection_type",
    "relation": "relation_name"
  }
]

Field
Description
source
Name of the source component.
target
Name of the target component.
type
Connection type: power, data, signal, or resource.
relation
Relationship associated with the connection.

The compiled file contains the connections defined in connection.twin, subject to the validation rules above.
3. spec.twin
Purpose
spec.twin defines the specifications and ratings of components. It supports shared defaults for component types and component-specific overrides.
Its behavior is similar to CSS:
A default specification defines the baseline values for all components of a given type.
A component-specific specification overrides values explicitly provided for that component.
Any values omitted from a component-specific specification are inherited from the corresponding default.
3.1 Example syntax
default:generator {
    rating@input {
        flowrate=100:200 unit="ltr/hr"
    }

    rating@output {
        voltage=120:255 unit=V
        current=50:60 unit=A
        frequency=50 unit=Hz
    }

    rating@state {
        temperature=30:40 unit=C
    }


    description="..."
    representation=generator
}

Generator1:generator {
    rating@state {
        temperature=40:45 unit=C
    }
}
In this example, Generator1 inherits the generator defaults, except that its state temperature range is overridden to 40:45 C.
3.2 Scope rules
The DSL permits only one outer scope.
The supported inner scopes are:
rating fields
dimension fields
For example, dimensions may be specified as:
dimension {
    length=100 unit=m
    width=125 unit=m
    height=130 unit=m
}
3.3 Rating fields
The rating scope supports three attributes:
input
output
state
These describe the component’s input requirements, output capabilities, and operating state, respectively.
3.4 Sensor specifications
Sensors follow the Single Responsibility Principle: each sensor measures exactly one value.
For example:
Generator1Voltmeter:sensor {
    measures=voltage
    rating=0:300 unit=V
}
This defines a sensor that measures voltage over the range 0–300 V.
3.5 Compilation output: spec.json
The compiler converts spec.twin into spec.json.
The generated file must include every component defined in hierarchy.json, with its specifications resolved from explicit values and inherited defaults.
For example:
[
  {
    "name": "Generator1",
    "type": "generator",
    "rating": {
      "input": {
        "flowrate": {
          "min": 100,
          "max": 200,
          "unit": "ltr/hr"
        }
      },
      "output": {
        "voltage": {
          "min": 120,
          "max": 255,
          "unit": "V"
        },
        "frequency": {
          "value": 50,
          "unit": "Hz"
        }
      }
    }
  },
  {
    "name": "Generator1Voltmeter",
    "type": "sensor",
    "measures": "voltage",
    "rating": {
      "min": 0,
      "max": 300,
      "unit": "V"
    }
  }
]
The example illustrates the structure for both a component with grouped ratings and a sensor with a single measurement rating.
3.6 Supported measurement types and units
The following measurement types and units are supported. Values must be converted and validated using Pydantic, with the specified canonical unit used internally.
Measurement type
Accepted units
Canonical Units
voltage
V,mV,kV
V
current
A,mA
A
power
W,kW
W
energy
Wh,kWh,J,kJ
J
light_irradiance
W/m2
W/m2
frequency
Hz,kHz,MHz,mHz
Hz
temperature
C,K,F
C
flowrate
cc/s,m3/hr,L/s,CFM,L/hr
L/s
air_particulates
ppm,bpm
ppm
o2_level
%
0-1
co2_level
%
0-1
volume
L,m3,cm3,ml
L
weight
kg,g,mg
kg
count
-
-

3.7 Mandatory sensor coverage
For every rating value type defined for a component, there must be a sensor connected to that component that measures that value.
This is a hard requirement.
For every measurement type, the required connection chain is:
Component → Sensor → Antenna
This ensures that each specified measurement can be collected by a sensor and transmitted through an antenna.
3.8 Default type specifications
Since the types are limited, their defaults shall be:
default:generator {
	rating@input {
		flowrate=0:135 unit=”L/hr”
	}
	rating@state {
		temperature=10:95 unit=C
	}
	rating@output {
		power=0:500 unit=kW
	}
	dimension {
		length=4 unit=m
		width=2 unit=m
		height=1.75 unit=m
	}
	description=”Generates electrical power”
	representation=generator
}
default:pump {
	rating@input {
		voltage=240 unit=V
		current=0:12 unit=A
	}
	rating@state {
		temperature=10:50 unit=C
	}
	rating@output {
		flowrate=90:600 unit=”L/hr”
	}
	dimension {
		length=0.4 unit=m
		width=0.3 unit=m
		height=0.2 unit=m
	}
	description=”Pushes liquid”
	HP=2
	representation=pump
}
default:solar_panel {
	rating@input{
		light_irradiance=0:1000 unit=”W/m2”
	}
	rating@output{
		power=0:400 unit=W
	}
	dimension {
		length=2 unit=m
		width=1 unit=m
		height=0.1 unit=m
	}
	description=”Converts solar energy into electrical power”
	representation=solar_panel
}
default:air_conditioner {
	rating@input {
		voltage=220 unit=V
		current=0:9 unit=A
	}
	rating@state {
		temperature=0:65 unit=C
	}
	rating@output {
		flowrate=0:1000 unit=”L/hr”
		temperature=16:40 unit=C
	}
	description=”Provides stable temperature source”
	representation=air_conditioner
}
default:tank {
	rating@state{
		volume=0:3000 unit=L
	}
	description=”holds water”
	representation=tank
}
default:sensor {
	measures=voltage
	rating=0:100 unit=V
	description=”Measures quantity”
	representation=sensor
}
default:storage {
	rating@state {
		count=0:200
		weight=0:1000 unit=kg
	}
	dimension {
		length=5  unit=m
		width=5  unit=m
		height=3  unit=m
	}
	description=”Stores items”
	representation=storage
}
default:alarm {
	rating@input {
		voltage=12 unit=V
		current=0:5 unit=A
	}
	description=”Alerts”
	representation=alarm
}
default:antenna {
	rating@input {
		voltage=15 unit=V
		current=0:5 unit=A
	}
	rating@state {
		frequency=40:75 unit=kHz
	}
	description=”Transmits signal”
	representation=antenna
}
default:vehicle {
	dimension {
		length=3 unit=m
		width=1.2 unit=m
		height=1.2 unit=m
	}
	description=”Transportation assist”
	representation=vehicle
}
default:server {
	rating@input {
		power=200:1000 unit=W
	}
	rating@state {
		temperature=10:50 unit=C
	}
	description=”Stores data”
	representation=server
}
default:vent {
	rating@input {
		voltage=30 unit=V
		current=0:2 unit=A
	}
	rating@output {
		flowrate=0:75 unit=”L/hr”
	}
	description=”Passes air”
	representation=vent
}
default:controller {
	rating@input {
		voltage=24 unit=V
		current=0:15 unit=A
	}
	description=”Signals components”
	representation=controller
}
default:station {
	rating@state {
		count=0:50 #count of the number of people
		temperature=0:30 unit=C
	}
	description=”Antarctic research station”
	representation=station
}
default:block {
	rating@state {
		temperature=10:30 unit=C
	}
	description=”Block inside the research station”
	representation=block
}
Simulation Configuration Files
A simulation uses three main configuration files:
component.json
connection.json
external.json
The first two represent the simulation’s current component and connection states. external.json provides shared environmental, network, and supply conditions.
4. external.json
Purpose
external.json stores the external conditions used by simulations. Its structure is common across simulations.
It contains three main groups: weather, network, and supplies.
4.1 Weather
The weather object contains:
Temperature
Wind speed
Humidity
O₂ level
CO₂ level
Wind direction
Visibility
Pressure
Dew frost point
4.2 Network
The network object contains:
Bandwidth
Mainland connectivity — available or unavailable
Upload window — on or off
Upload speed — canonical unit: KB/s
Download speed
4.3 Supplies
The supplies field contains a list of supplies. Each supply includes:
ETA of the next supply, stored in days
Supply description
Mode of transportation, such as air or water
4.4 Example structure
{
  "weather": {
    "temperature": {
      "value": -30,
      "unit": "C"
    }
  },
  "network": {
    "...": "..."
  },
  "supplies": [
    {
      "ETA": 12.7,
      "mode": "air",
      "description": "..."
    }
  ]
}
The example is abbreviated; the complete configuration includes the applicable weather, network, and supply fields described above.
It represents runtime state, whereas the database represents persistent history. 
5. component.json
Purpose
component.json stores the current state of every component for the current simulation iteration.
It is generated using spec.json by identifying each component, its type, and the values it can accept, produce, or maintain.
A status field is added to each component.
5.1 Canonical values
All values stored in component.json must use their canonical units.
Consequently, the simulation’s component values do not need to store a unit alongside each value.
5.2 Component status
The status field supports the following values:
inactive
active
failure
5.3 Example structure
[
  {
    "name": "ComponentName",
    "type": "ComponentType",
    "is_backup": false,
    "status": "active",
    "value": {
      "datafield1": "Field1 data in canonical form",
      "...": "..."
    }
  }
]
Each entry contains the component’s identity, type, backup designation, current status, and current values.
If multiple values exist of same name in different sections, that is state,input,output, then the stored value may be represented as:
“value”: {
  “datafield1”:Field1 data in canonical form
  “datafield2”:{
    “state”: field2 data in state section in canonical form
    “output”: field2 data in output section in canonical form
  }
}
5.4 Runtime State and Persisted Telemetry
component.json represents the current runtime state of the simulation.
When telemetry publishing is enabled, the runtime state is captured at every simulation tick and persisted as a telemetry record.
Therefore:
component.json→current runtime simulation state
telemetry database→persisted historical simulation states
The telemetry database does not replace the simulation runtime state. It provides persistent historical snapshots of the simulation state.
6. Simulation connection.json
The simulation engine maintains its own connection.json, separate from the compiled connection.json generated from connection.twin.
The simulation version:
Retains the source, target, and connection type from the compiled connection data.
Removes the relation field.
Adds a status field to track the current connection state.
6.1 Connection status
The status field supports:
active
inactive
failure
6.2 Example structure
[
  {
    "source": "SourceNodeName",
    "target": "TargetNodeName",
    "type": "connection_type",
    "status": "active"
  }
]
This file represents the current operational state of connections during the simulation.
It represents runtime state, whereas the database represents persistent history. 
Simulation Telemetry and Persistence
The simulation shall support an optional telemetry-publishing mode that allows simulated station state to be published as station telemetry and persisted in the telemetry database.
The Scenario / Simulation page shall provide a control:
Publish Simulation as Live Telemetry
When enabled, the simulation runtime shall publish the current simulated station state as telemetry.
Telemetry Sampling
One telemetry record shall be generated for every simulation tick.
At the default playback rate:
1 real-world second = 1 simulation tick = 15 simulation seconds
Therefore, when telemetry publishing is enabled, the database receives one simulated telemetry record per real-world second, with each successive record representing another 15 seconds of simulated station time.
The telemetry stream shall therefore preserve the simulation at its tick resolution.
Telemetry Contents
A telemetry record shall contain the applicable current state of:
components
component values
component statuses
connection statuses
external fields
Each telemetry record shall also contain sufficient metadata to identify:
station/model
simulation or scenario run
simulation timestamp
real-world persistence timestamp
telemetry source
Simulation-generated telemetry shall be distinguishable from telemetry originating from physical station systems.
Telemetry Publishing
When telemetry publishing is disabled:
Simulation→Runtime simulation state
When telemetry publishing is enabled:
Simulation→Runtime simulation state→Telemetry record→Telemetry database
Stopping telemetry publishing shall not stop or otherwise modify the simulation itself.
Every telemetry stream generated by a simulation shall be associated with a unique simulation run identifier. This identifier shall allow telemetry generated by different executions of the same scenario to be distinguished and reconstructed independently. 
Simulation Timeline DSLs
Simulation timelines are defined using two additional DSL file types:
.scene
.event
A scene file defines the events that occur during a simulation timeline. It references event files and specifies when each event begins and how long it lasts.
An event file defines the behavior of an event, including which nodes it targets, any filtering conditions, and which fields it modifies.
Event files function like reusable modules or functions that can be instantiated in a scene.
Simulation Time Model
The engine relies on a discrete temporal framework split into time units and discrete ticks.
A single unit of simulation time equates to an hour.
A single time tick in the simulation equates to 15 seconds.
Under standard playback conditions, execution progresses at the rate of one tick for every real-life second.
As a result, each real-world second yields 15 seconds within the modeled environment.
There are 240 distinct ticks contained within a single simulated hour.
The temporal mapping is structured as follows:
1 simulation time unit
	= 1 simulation hour
	= 3600 simulation seconds
	= 240 simulation ticks
At standard speed:
1 real life second
	= 1 simulation tick
	= 15 seconds in simulation time
The system clock operates independently of actual time. Event scheduling, active durations, system state adjustments, and telemetry records depend strictly on internal simulation time.
Illustrative timeline progression:
Initial time: 00:00:00
After 1 second elapsed:
	Current time: 00:00:15
After 4 seconds elapsed:
	Current time: 00:01:00
After 240 seconds elapsed:
	Current time: 01:00:00
Adjusting execution velocity modifies how rapidly ticks are calculated, but it must not alter the period assigned to each tick, event sequence, internal timestamps, or duration spans.
7. Scene files (.scene)
7.1 Event declaration syntax
A scene instantiates events using an event reference, optional target selector, start time, and duration.
Examples:
event:failure @Generator1 at=1.0 for=2.0

event:failure @generator at=1.5 for=0.5

event:failure_except_backup @generator at=2.0 for=1.0

event:network_outage at=2.0 for=inf

event:connection_failure @(|data|) at=1.0 for=6.0

event:set_external @network at=1.0 for=0.5 {
    set {
        up=0.5
        down=1.0
    }
}

event:set_component @Generator1 at=1.2 for=inf {
    set {
        value {
            voltage=121.7
            current=50.2
        }
    }
}
event:fix_connection @(Generator1|data|) at=2.0 for=inf
Scene Event Timing
All .scene event timing uses simulation time.
The at field specifies the event's start time in simulation time units, where:
	1 simulation time unit = 1 hour
The for field specifies the event's duration in the same simulation time units.
For example:
	event:failure @Generator1 at=1.0 for=2.0
means:
Start:
    1 simulation hour
Duration:
    2 simulation hours
End:
    3 simulation hours
The simulation engine evaluates state changes at its simulation-tick resolution:
1 simulation tick = 15 simulation seconds
Therefore, event timing is expressed in simulation time units while runtime state evaluation occurs at the simulation tick resolution.
7.2 Event timing attributes
Each scene event may specify:
at — the simulation time at which the event is instantiated.
for — the duration for which the event remains in effect.
A duration of inf means that the event does not expire through its duration timer.
Events are processed in chronological order according to their at values.
If two events have the same at= timestamp, the event appearing first in the scene file is instantiated first.
This is equivalent to a stable sort by at.
8. Event files (.event)
Event files define the targets and operations performed when an event is instantiated.
8.1 Example event definitions
failure.event
target @component.type | @component.name
set status=failure
failure_except_backup.event
target @component.type | @component.name
where is_backup=false
set status=failure
network_outage.event
target @external.network
set {
	mainland_connectivity=false
	upload_speed=0.00
	download_speed=0.05
}
connection_failure.event
	target @connection
	set status=failure
set_external.event
	target @external
	set fields
set_component.event
	target @component.name
	set fields { value }
fix_connection.event
	target @connection
	where status=failure
	set status=active
These examples illustrate the supported target selection, filtering, and mutation patterns.
9. Referencing nodes in event files
Event files can reference components, connections, and external data through the target clause.
The scene file supplies the selector values where required.
9.1 Component references
Components can be referenced using:
@component.name
@component.type
The selector determines which components are selected by the event.
By component name
Event:
	target @component.name
Scene:
	event:failure @Generator1 at=1.0 for=2.0
This selects the component named Generator1. Since component names are globally unique, this selects exactly one component.
By component type
Event:
	target @component.type
Scene:
	event:failure @generator at=1.0 for=2.0
This selects all components whose type is generator.
Combined name and type selector
An event may use:
	target @component.type | @component.name
In this case, the selector can match either the component type or the component name supplied in the scene file.
A standalone @component reference is invalid: it must include a supported specifier.
9.2 Connection references
Connections can be referenced using @connection and its fields.
A connection is identified by its source node, connection type, and target node.
Full connection selector
	target @connection
Scene:
	event:connection_failure @(Generator1|data|Antenna1) at=1.0 for=2.0
The scene selector uses the following format:
	(source_node_name|connection_type|target_node_name)
Each field is optional, but the parenthesized three-field syntax must be retained, and at least one field must be supplied.
For example:
	@(|data|)
selects connections of type data.
Field-specific connection selectors
The following forms are supported:
@connection.source
@connection.target
@connection.type
For these field-specific selectors, the scene file provides only the value for the specified field, without the three-field parenthesized syntax.
For example:
	target @connection.source
with a scene selector of:
	@Generator1
selects connections whose source is Generator1.
The same principle applies to the target and type fields.
Selectors using multiple connection fields
An event may specify two distinct connection fields with @connection.(field1 & field2). The scene selector retains the (source|type|target) format, with the unused field left empty.
The two selected fields must be different.
9.3 External references
An event can target external data using @external.
When the event uses the general @external target, the scene file must specify which external group to select, such as:
@network
@weather
@supplies
Alternatively, an event can target a specific external group directly:
@external.network
@external.weather
@external.supplies
When one of these specific references is used, the scene file does not need to provide an additional selector.
10. The where clause
The where clause filters the nodes selected by an event’s target.
Its behavior is similar to a SQL WHERE clause:
The condition is evaluated for each selected node.
Nodes for which the condition evaluates to true are retained.
Nodes for which it evaluates to false are excluded.
10.1 Filtering components by their fields
The where clause can inspect fields of selected components and compare them against specified values.
Examples:
	where value.temperature>30.0
	where is_backup=true
10.2 Referencing connections from a component
When the selected node is a component, the where clause can inspect connections associated with that component.
Examples:
	where @connection(@node|data|)
Filters components based on whether they have a connection originating from the component with data type.
	where @connection(@node||@component.type=generator)
Filters components based on whether they have a connection originating from the component and terminating at a component of type generator.
	where @connection(MainController||@node)
Filters components based on whether they have a connection originating from MainController and terminating at the selected component.
Connection fields can also be inspected:
	where @connection(@node||).status=failure
This filters based on the status of connections originating from the selected component.
10.3 Referencing components from a connection
When the selected node is a connection, the where clause can inspect the components at its source and target.
Examples:
	where @component(source).type=generator
	& type=data
	& @component(target).type=sensor
This filters connections based on the source component type, connection type, and target component type.
Another example:
	where @component(source).is_backup=true
This filters connections whose source component is designated as a backup.
11. The set clause
The set clause defines which fields an event is allowed to modify and, where specified, the values to assign.
11.1 Setting fields through the scene file
If an event declares:
	set fields
the scene file may set any fields of the selected node.
For example, the scene can provide values for the fields of the selected component or connection.
11.2 Restricting which fields may be set
An event can restrict scene-level modifications to a particular field.
For example:
	set { value }
This allows the scene file to modify members of the selected node’s value field, rather than arbitrary fields on the node.
11.3 Defining fixed values in the event file
If a field’s value should be defined by the event itself rather than supplied by the scene, the event can specify the value directly.
For example:
	set value.temperature=124.2
11.4 Combining editable fields and fixed values
An event may combine fields that can be edited by the scene with values fixed in the event definition.
For example:
set {
  values.temperature
  values.voltage.output=120
  status=failure
  fields
}
In this example:
values.temperature may be edited by the scene.
values.voltage is fixed at 120.
status is fixed at failure.
fields allows additional fields to be set.
The scene file cannot override the fixed voltage or status values. It can modify the permitted temperature value and any additional fields allowed by the fields declaration.
11.5 Immutable fields
The is_backup field is immutable. It cannot be changed through a set clause.
11.6 Infinite-duration events
A set event with for=inf becomes the new underlying state at the time it is applied.
When this occurs:
Previously active sets on the affected fields are removed.
The new values are written into the underlying component or connection state, rather than remaining only in the temporary event stack.
Those fields become mutable again, subject to the event’s applicable set restrictions.
By contrast, sets with finite durations remain active only for their specified duration.
12. Reverting temporary event changes
When an event’s duration expires, its temporary changes are reversed, restoring the previous state of the affected fields.
This behaves like stack unwinding when multiple events modify the same field.
Consider the following:
Field X initially has value R.
Event A changes X to S for N time units.
Event B changes X to T for M time units.
Both events are instantiated at the same time.
Event A appears before Event B in the scene file.
The resulting behavior is:
If M > N, Event A expires first, and X remains T.
If N > M, Event B expires first, and X reverts to S. When Event A subsequently expires, X reverts to R.
The active event stack therefore determines which value is restored when a temporary change expires.
Default Simulation Conditions
The simulation engine applies the following default behaviors and constraints.
13. Backup components
Backup components remain off until at least one component of the same type that it is designated to backup is active.
A backup component automatically turns on when all components it backs up are turned off, either through inactive or failure status.
A scene file may activate a backup component before these default conditions are met.
14. Controllers and operational values
Components connected to a controller through a signal connection can have their operational values adjusted by that controller.
These adjustments are based on other components and system requirements.
For example, if a generator is connected to a controller and energy demand increases, the generator may automatically increase its power output to meet that demand.
If a controller is not active, or the connection between the controller and a component is not active, that component cannot automatically adjust its input or output requirements.
15. Tolerance and rating limits
The simulation supports a tolerance percentage that determines how far a component may operate above or below its specified rating.
Tolerance is defined at two levels:
A component-specific tolerance.
A global tolerance.
If a component has tolerance x and the global tolerance is y, the total tolerance for that component is:
x × (1 + y / 100) %
To improve simulation determinism, rating@state values should be kept within their intended ranges or specified values whenever possible.
If a component exceeds its rating range and the applicable tolerance, it may continue operating for a few simulation time steps. After that, its status changes to failure.
16. Automatic activation and resource allocation
Inactive components of a given type may become active to help active components meet system demands.
This automatic activation is not allowed when the component’s inactive state has been explicitly set by a scene file.
If resource demands still cannot be fulfilled, components requesting those resources are made inactive according to their priority.
Lower numerical priority values indicate higher priority, as defined in hierarchy.twin.
17. Hierarchical status propagation
If an outer component is in the inactive or failure state, its inner components do not function.
The simulation does not need to explicitly set the status of every inner component. It can determine whether a component’s ancestors are inactive or failed by consulting hierarchy.json.
18. Missing data and inactive connections
If a connection carrying data is not active, the data passed through that connection is NULL.
When data is missing, the simulation model must extrapolate the missing value using either:
Other available, non-missing data.
Previously valid data for the missing field.
This allows the simulation to continue handling incomplete data when data connections are unavailable.
Simulation Behaviour
The simulation engine shall evaluate component behaviour at every simulation tick. Component behaviour shall be determined from the component's current state, its ratings and tolerances, its active connections, available resources, and the behaviour rules defined for its component type.
A simulation time unit represents one simulation hour. A simulation tick represents 15 simulation seconds. Under the default playback rate, one real-world second corresponds to one simulation tick.
The formulae will be written in Latex, but following them will be a human readable version with grey text inside brackets.
1. General Component Behaviour
1.1 Rating limits and failure
If any state field of a leaf component exceeds its max_rating_limit, the component may begin a countdown toward failure.
The time before failure shall be calculated as:
	t_{\mathrm{off}}=1-3a_c^2+2a_c^3 [toff=1-3ac2+2ac3]
where:
	a_c=\operatorname{clamp}(a,0,1) [ac=clamp(a,0,1)]
and:
a= \frac{\mathrm{current\_value}-\mathrm{max\_rating\_value}} {\mathrm{max\_tolerated\_value}-\mathrm{max\_rating\_value}} [a=Rcurr-RmaxRtol(SPF)-Rmax]
The applicable component tolerance shall be calculated as:
\mathrm{specific\_tolerance} = \mathrm{component\_tolerance} \left(1+\frac{\mathrm{global\_tolerance}}{100}\right) [Tspecific=Tcomponent(1+Tglobal100)]
The Specific tolerance factor (SPF) shall be:
\mathrm{SPF}=1+\frac{\mathrm{specific\_tolerance}}{100} [SPF=1+Tspecific100]
and the maximum tolerated value shall be:
\mathrm{max\_tolerated\_value} = \mathrm{max\_rating\_value}\cdot\mathrm{SPF} [Rtol=Rmax(SPF)]
The countdown shall only result in failure if the component remains outside its permitted operating range for the calculated duration. If the component returns to within its applicable rating/tolerance range before the countdown completes, the failure countdown shall be cancelled and the component shall be considered safe to continue operating.
The countdown shall be evaluated using simulation time rather than wall-clock time.
1.2 Component power calculation
The simulation shall calculate the power requirement or output of every component for which power is applicable.
If an explicit power value is provided by the component specification or current component state, that value shall be used.
If no explicit power value is available, power shall be calculated from voltage and current:
P=VI
The explicit power value shall therefore take precedence over a calculated value from voltage and current.
1.3 Multiple active power supplies
If a component has multiple active power supplies, the component shall distribute its power demand between those supplies.
A component shall request a greater proportion of its required power from the active source having the lower current load. This shall allow available power capacity to be distributed between multiple sources rather than unnecessarily increasing the load of an already heavily loaded source.
1.4 Automatic activation and priority
When a resource cannot satisfy the requirements of all currently active components, the simulation may activate inactive components when doing so allows the system to satisfy the required resource threshold.
Priority shall follow the hierarchy priority value:
Lower numerical values indicate higher priority.
Higher numerical values indicate lower priority.
When a resource remains insufficient, the lowest-priority applicable component shall be made inactive before a higher-priority component.
An inactive component whose inactive state was explicitly imposed by a scene event shall not be automatically activated.
2. Generator Behaviour
2.1 Power allocation
Consider components A, B, and C connected to generator D. If:
	P_D < P_A+P_B+P_C [PD<PA+PB+PC]
the generator shall first attempt to increase its power output, provided that it has sufficient capacity to do so.
If the generator cannot satisfy the complete demand but can provide at least 35% of the total requested power, it shall distribute its available power equally between the requesting components.
The supplied percentage shall be:
x= \frac{P_D}{P_A+P_B+P_C} [x=PDPA+PB+PC]
Each component shall then receive x times its requested power.
If the generator cannot provide at least 35% of the requested total power, the component with the lowest priority shall be shut down by setting it to inactive.
If inactive components exist and activating the highest-priority applicable inactive component allows the active components to receive at least 35% of their required power, the simulation shall activate that inactive component instead of shutting down an active component.
This automatic activation shall not override an inactive state explicitly imposed by a scene.
2.2 Generator temperature
The generator temperature shall be recalculated at every simulation tick.
The temperature equation shall be:
T_{\mathrm{curr}}(n) = T_{\mathrm{curr}}(n-1) + \beta \left( \alpha_{\mathrm{component}}T \frac{P_{\mathrm{curr}}}{P} + T_{\mathrm{surr}} - T_{\mathrm{curr}}(n-1) \right) [Tcurr(n)=Tcurr(n-1)+(componentTPcurrP+Tsurr-Tcurr(n-1))]
where:
T_{\mathrm{curr}}(n) [Tcurr(n)]is the generator temperature during the current iteration.
T_{\mathrm{curr}}(n-1) [Tcurr(n-1)] is the generator temperature during the previous iteration.
T is the generator temperature range represented by:
	T= \mathrm{maximum\_rating\_temperature} - \mathrm{minimum} [T=Trating,max-Trating,min]
P_{\mathrm{curr}}[Pcurr] is the generator's current power output.
P is the generator's available power range represented by:
	P= \mathrm{maximum\_power\_output} - \mathrm{minimum} [P=Prating,max-Prating,min]
T_{\mathrm{surr}} [Tsurr] is the temperature of the container in which the generator is located.
\alpha_{\mathrm{component}} [component] is the coefficient representing the effect of generated heat on the generator itself.
The default value of \alpha_{\mathrm{component}} is 0.225 [component=0.225].
\beta is the damping coefficient [].
The default value of \beta is 0.5 [=0.5].
2.3 Generator flowrate and power
Generator flowrate and generated power shall be directly proportional.
Required flowrate shall be:
\mathrm{flowrate}_{\mathrm{required}} = \mathrm{max\_rating\_flowrate} \frac{P_{\mathrm{curr}}}
{\mathrm{max\_rating\_power}} [FRrequired=FRrating,maxPcurrPrating,max]
Conversely, the maximum power that the generator can produce shall be constrained by its available flowrate.
Therefore, if the generator can receive only 80% of its maximum rated flowrate, its maximum possible power output shall also be approximately 80% of its maximum rated power.
2.4 Generator startup deadlock prevention
If a generator is inactive and the pump responsible for supplying its required flowrate is also inactive, the generator may start at its minimum operating capacity.
This allows the associated pump to start. As flowrate becomes available, the generator may increase its power output and begin supplying other components.
This behaviour prevents a generator-pump system from becoming permanently soft-locked and allows a backup generator to become operational when required.
3. Pump Behaviour
3.1 Required flowrate
A pump shall determine its required output flowrate from the total flowrate required by the components connected to it.
For components A, B, and C:
	FR_P=FR_A+FR_B+FR_C [FRP=FRA+FRB+FRC]
where FR_P is the required flowrate from pump P.
3.2 Insufficient flowrate
If:
	FR_A+FR_B+FR_C>FR_P [FRP<FRA+FRB+FRC]
the pump shall first attempt to increase its output flowrate, provided that it has remaining capacity.
If the pump is already at its maximum flowrate but can provide at least 30% of the total required flowrate, it shall distribute its available flowrate equally among the requesting components.
The supplied percentage shall be:
x= \frac{FR_P} {FR_A+FR_B+FR_C} [x=FRPFRA+FRB+FRC]
Each requesting component shall receive x times its requested flowrate.
If the pump cannot provide at least 30% of the total required flowrate, the lowest-priority component shall be forced to inactive.
If inactive components exist and activating the highest-priority applicable inactive component allows the active components to receive at least 30% of their required flowrate, the simulation shall activate that component.
3.3 Pump temperature
The temperature calculation for a pump shall use the same temperature model as a generator, except that flowrate shall be used instead of power.
The resource term shall therefore be based on:
	\frac{FR_{\mathrm{curr}}}{FR} [FRcurrFR]
where FR_{\mathrm{curr}} [FRcurr] is the current pump flowrate and FR is the pump's rated flowrate range.
3.4 Pump power and flowrate
Pump power consumption and flowrate shall be directly proportional.
Increasing the required or delivered flowrate shall correspondingly increase the pump's power requirement within its rated operating range.
4. Solar Panel Behaviour
The output power of a solar panel shall be directly proportional to its input light irradiance.
Thus:
	P_{\mathrm{curr}} = P_{\mathrm{max}} \frac{I_{\mathrm{curr}}} {I_{\mathrm{max}}} [Pcurr=PmaxIcurrImax]
where I_{\mathrm{curr}} [Icurr] is the current light irradiance and I_{\mathrm{max}} [Imax] is the maximum rated irradiance.
The resulting power shall not exceed the panel's maximum rated output.
5. Tank Behaviour
The volume of a tank shall decrease according to the total flowrate being drawn from the tank and the elapsed simulation time.
For connected pumps:
	V_{\mathrm{curr}}(n) = V_{\mathrm{curr}}(n-1) - \left( \sum FR_{\mathrm{pump}} \right)\Delta t [Vcurr(n)=Vcurr(n-1)-t(FRpump)]
where \Delta t is the elapsed simulation time represented by the current tick.
Tank volume shall not become negative.
If a tank becomes empty, all pumps relying on that tank as a resource source shall be turned off.
A pump shall remain operational if it has another connected tank that is non-empty and can continue supplying the required resource.
6. Antenna Behaviour
The frequency state of an antenna shall be randomly generated within its rated frequency range.
The generated frequency value shall not contribute to the simulation's resource calculations or other component behaviour.
The current requirement of an antenna shall depend on its number of active connections:
If the antenna has zero active connections, its required current is 0A.
If it has fewer than 20 active connections, its required current is:
	I_{\mathrm{required}} = \frac{I_{\mathrm{max}}}{2} [Irequired=Imax2]
If it has 20 or more active connections, its required current is:
	I_{\mathrm{required}} = I_{\mathrm{max}} [Irequired=Imax]
7. Server Behaviour
The temperature of a server shall be calculated using the same temperature model as a generator.
The difference is that server temperature shall be based on the server's current power requirement rather than a generator's current power output.
Thus, the power term shall use:
	\frac{P_{\mathrm{required}}}{P} [PrequiredP]
where P_{\mathrm{required}} [Prequired] is the server's current power requirement.
8. Alarm Behaviour
An inactive alarm shall consume:
	I=0A
When an alarm is active, it shall consume:
	I=5A
Its corresponding power requirement shall be calculated according to the general component power calculation.
9. Air Conditioner Behaviour
9.1 Current requirement
The current requirement of an air conditioner shall be calculated as:
I_{\mathrm{required}} = I_{\mathrm{max}} \left[ \alpha \left( \frac{FR_{\mathrm{curr}}}{FR_{\mathrm{max}}} \right) + (1-\alpha) \operatorname{clamp} \left( \frac{ \left|T_{\mathrm{output}}-T_{\mathrm{surr}}\right| }{ T_{\mathrm{max}}-T_{\mathrm{min}} }, 0,1 \right) \right] [Irequired=Imax(FRcurrFRoutput+(1-)clamp(Toutput-TsurroundingTmax-Tmin,0,1))]
where:
	\alpha=0.4 [=0.4]
The required power shall then be calculated using the air conditioner's voltage and current:
	P_{\mathrm{required}} = V_{\mathrm{curr}}I_{\mathrm{required}} [Prequired=VcurrIrequired]
9.2 Air conditioner temperature
The state temperature of an air conditioner shall be calculated using the same temperature model as the generator, except that the air conditioner's power requirement shall be used instead of generator power output.
9.3 Airflow requirement
The total airflow requirement of an air conditioner shall be the sum of the airflow requirements of all vents connected to it:
	FR_{\mathrm{required}} = \sum_{k=1}^{N_{\mathrm{vent}}}FR_{\mathrm{vent},k} [FRrequired=k=1NventFRvent,k]
If the total required flowrate exceeds the air conditioner's current output flowrate, the air conditioner shall attempt to increase its flowrate output.
If it cannot satisfy the complete requirement, it shall output the maximum flowrate that it can provide.
Unlike generator and pump resource allocation, the air conditioner shall not apply a 30% or 35% minimum-output cutoff to its airflow.
9.4 Output temperature
The air conditioner's output temperature shall move gradually toward its target temperature.
At every simulation tick:
T_{\mathrm{out}}(n) = T_{\mathrm{out}}(n-1) + \beta \left( T_{\mathrm{target}} - T_{\mathrm{out}}(n-1) \right) [Tout(n)=Tout(n-1)+(Ttarget-Toutput(n-1))]
where:
T_{\mathrm{target}} [Ttarget] is the current target temperature.
\beta []is the damping coefficient.
The default value of \beta is 0.5 [=0.5].
The output temperature shall therefore approach the target gradually rather than immediately changing to the target value.
9.5 Insufficient power
If an air conditioner receives insufficient power but receives a non-zero amount of power, it shall continue operating at the reduced available power rather than immediately shutting down.
The air conditioner may only shut down due to its state temperature exceeding its applicable rating/tolerance limit and remaining above that limit for the calculated failure duration defined by the general component failure rule.
10. Vent Behaviour
The power requirement of a vent shall be calculated from its voltage and current:
	P=VI
The current requirement of a vent shall be directly proportional to its airflow.
Thus, increasing the airflow through a vent shall proportionally increase its current requirement up to its maximum rated current.
11. Container Type Behaviour
11.1 Container temperature
The temperature of a container shall be recalculated at every simulation tick.
The temperature equation shall be:
T_{\mathrm{curr}}(n) = T_{\mathrm{curr}}(n-1) + \beta \left( \alpha_{\mathrm{inner}}I_{\mathrm{avg}} + V_{\mathrm{all}} + \alpha_{\mathrm{surr}}T_{\mathrm{surr}} - T_{\mathrm{curr}}(n-1) \right) [Tcurr(n)=Tcurr(n-1)+(innerIavg+Vall+surrTsurr-Tcurr(n-1))]
where:
\beta [] is the damping coefficient.
The default value of \beta is 0.5 [=0.5].
\alpha_{\mathrm{inner}} [inner] represents the effect of the temperatures of inner components.
The default value of \alpha_{\mathrm{inner}} is 0.225 [inner=0.225].
\alpha_{\mathrm{surr}} [surr] represents the effect of the parent/container temperature.
The default value of \alpha_{\mathrm{surr}} is 0.8 [surr=0.8].
T_{\mathrm{surr}} [Tsurr] is the temperature of the parent component.
I_{\mathrm{avg}} [Tavg] is the average temperature of the container's inner components.
V_{\mathrm{all}} [Vall] represents the airflow-weighted temperature contribution of air conditioners connected through vents.
The average inner-component temperature shall be:
I_{\mathrm{avg}} = \frac{1}{N_{\mathrm{inner}}} \sum_{k=1}^{N_{\mathrm{inner}}}T_k [Iavg=1Ninnerk=1NinnerTk]
where:
N_{\mathrm{inner}} [Ninner] is the number of children of the container.
T_k [Tk] is the temperature of the k-th child.
The airflow-weighted air-conditioner contribution shall be:
V_{\mathrm{all}} = \frac{1}{A_{\mathrm{mtotal}}} \sum_{k=1}^{N_{\mathrm{vent}}} V_kA_{\mathrm{curr,k}} [Vall=1Amtotalk=1NventVkAcurr,k]
where:
N_{\mathrm{vent}} [Nvent] is the number of vents connected to air conditioners.
V_k [Vk] is the output temperature of the air conditioner associated with the k-th vent.
A_{\mathrm{curr,k}} [Acurr,k] is the current airflow through the k-th vent.
A_{\mathrm{mtotal}} [Amtotal] is the total maximum airflow:
	A_{\mathrm{mtotal}} = \sum_{k=1}^{N_{\mathrm{vent}}}A_{\mathrm{max,k}} [Amtotal=k=1NventAmax,k]
A_{\mathrm{max}_k} [Amax,k] is the maximum airflow rating of the k-th vent.
11.2 Container thermal response
Container types shall not immediately enter failure merely because their temperature exceeds their rating temperature, including when the applicable tolerance has been exceeded.
Instead, the container shall first attempt to reduce its temperature through available environmental controls.
The simulation shall attempt these actions in order:
Increase the airflow of connected vents if their current airflow is below their maximum allowed rating.
If the connected vents are already at their maximum allowed airflow, decrease the target temperature of the applicable air conditioner by 2^\circ C.
If the temperature remains above the desired amount, the container may attempt to decrease the temperature output of its inner components or inner containers.
Container thermal control shall therefore attempt corrective actions before applying ordinary leaf-component failure behaviour.
12. Station Behaviour
A station's minimum surrounding/container temperature shall be maintained at 20^\circ C above the external temperature.
Therefore:
	T_{\mathrm{surr}} = T_{\mathrm{external}} + 20 [Tsurr=Texternal+20]
This value shall be used as the station's minimum surrounding temperature when calculating station temperature as a container and when calculating station environmental behaviour and shall be based on the current external temperature supplied by the simulation environment.
Frontend Specification — Antarctic Research Station Digital Platform
1. Application Overview and Navigation
The frontend provides an integrated interface for remotely monitoring, exploring, and simulating the operations of an Antarctic research station.
The application should use a consistent design system across all pages, with shared component inspectors, status indicators, interaction patterns, and navigation.
1.1 Global navigation bar
The main navigation bar should contain:
Left: A station/model selector that allows users to switch between available stations or digital twins. The selected station determines the corresponding site link and application data.
Center: Navigation links for:
Overview
Digital Twin
Components
Connections
Scenario / Simulation
History and Diagnostics
Right: A theme selector that allows users to switch between dark and light modes.
The selected station/model should remain consistent when navigating between pages. Switching stations should load the corresponding station's data and context.
2. Overview
2.1 Purpose and layout
The Overview page provides a high-level summary of the selected Antarctic research station, including its current operational condition, key measurements, and the status of its major components.
The page should follow this layout:
Station name.
Satellite image of the station.
Main operational dashboard.
A rotating selection of major component cards.
2.2 Station header and satellite image
At the top of the page, display the name of the currently selected station/digital twin.
Below the station name, display a satellite image of the station.
The image should provide visual context for the station being monitored.
2.3 Main dashboard
Below the satellite image, display a dashboard containing cards for the following metrics:

Metric
Information Displayed
Component status
Number of active components out of the total number of components.
Station power output
Current power output of the station.
Station temperature
Current temperature of the station.
Next supply arrival
Estimated time remaining until the next supply reaches the station.

The dashboard should provide a concise overview of the station's current operational state.
2.4 Major component cards
Below the main dashboard, display a selection of randomly chosen block-type components.
Each card should contain:
A picture related to the block.
The block's name.
Its current operational status: active, inactive, or failed.
The number of functioning inner components out of the total number of inner components.
The displayed selection should periodically change to other randomly selected blocks.
Transition behavior: When the displayed components change, use a fading animation to transition between the old and new cards.
3. Digital Twin
Digital Twin Dynamic State
The Digital Twin page shall use the compiled digital-twin model to determine the station's static structure, hierarchy, specifications and topology.
The latest persisted telemetry record shall provide the current dynamic state displayed by the Digital Twin.
Therefore:
Digital Twin structure← hierarchy.json / connection.json / spec.json
Digital Twin current state← latest telemetry database record
The latest available telemetry record shall provide the values and statuses displayed for:
components
connections
external fields where applicable
The 3D geometry and topology shall continue to be derived from the digital-twin model. Telemetry updates the dynamic state represented on that model.
If no telemetry record is available, the Digital Twin shall clearly indicate that current telemetry is unavailable rather than presenting fabricated current values.
3.1 Purpose and layout
The Digital Twin page provides an interactive, procedurally generated 3D representation of the selected station.
The visualization should be constructed using React Three and the compiled hierarchy.json and connection.json files.
The page should use a workspace layout consisting of:
Left: A collapsible tool panel containing hierarchy, connections, and settings.
Center: The interactive 3D station visualization.
Right: Station information, hover information, and component/connection inspectors.
Bottom of the left panel: A Focus button for resetting the 3D view.
The right-side cards should be arranged vertically, with the station information card at the top, the hover information card below it when present, and the inspector below the hover card when a selection exists.
3.2 Left tool panel
The left panel should behave similarly to the VS Code sidebar.
It should contain three sections:
Hierarchy
Connections
Settings
Each section should be opened by clicking its corresponding button.
Clicking a button for a section that is already open should close that panel. Opening another section should display its corresponding panel.
A Focus button should remain available at the bottom of the sidebar.
3.3 Settings
The Settings panel should contain two main sections: Interactivity and View.
3.3.1 Interactivity
The Interactivity section should contain the following controls:

Setting
Default
Behaviour
Components interactable
On
Enables or disables interaction with components.
Connections interactable
On
Enables or disables interaction with connections.
Interactable floor level
0
Restricts component interaction to the specified floor level.

The Interactable floor level should be an editable numeric field.
By default, the selected floor level is 0, representing the ground floor.
When a floor level is specified, components should only be interactable if they belong to that floor level.
Components and floor containers outside the specified interactable floor level should become almost transparent.
If both Components interactable and Connections interactable are turned off, all components and connections should have the same transparency. They should not be visually differentiated according to floor level.
3.3.2 View
The View section should contain:
Visibility controls
Hide all components: Hides all components in the 3D view when enabled.
Hide all connections: Hides all connections in the 3D view when enabled.
Hiding a component should not be confused with hiding a connection. The global visibility controls should operate independently.
Lighting
Provide a selection menu with three options:

Mode
Behaviour
Off
Turns off lighting and removes shadows.
Baked
Uses precomputed shadows that do not require recomputation.
Dynamic
Uses dynamic lighting for the highest available visual quality.

Default: Off.
Occlusion
Provide a selection menu with two options:

Mode
Behaviour
Off(translucent)
Container types are translucent by default, allowing their inner components to remain visible.
Off on hover
Container types are soild and opaque by default. They become translucent when hovered over, allowing users to see their inner components.

Default: Off (translucent).
3.4 Hierarchy panel
The Hierarchy panel should display all components defined in hierarchy.twin, using the compiled hierarchy data.
It should behave like a file explorer:
Container-type components behave like folders.
Leaf components behave like files.
Container nodes can be expanded and collapsed.
Each component should have a visibility toggle.
Containers should have visibility toggles that affect their entire subtree.
When a container is hidden, all of its inner components should also be hidden.
Connections associated with hidden components should also be hidden. Hiding a component through the hierarchy should not leave its connected wires visible.
3.4.1 Hierarchy controls
At the top of the panel, provide:
Expand All
Collapse All
These controls should expand or collapse the hierarchy tree accordingly.
3.4.2 Status indicators
Components should display status tags on the right side of their hierarchy entries.
inactive: Display an inactive status tag.
failure: Display a failed status tag.
active: Display an active status tag when the component is active.
Container status should reflect the states of its inner components.
Display a gray dot if any inner component is inactive.
Display a red dot if any inner component has failed.
Display an active status tag only when all inner components are active.
The behavior should resemble status propagation in a Git-managed directory, where changes in nested files are reflected in their containing folders.
3.5 Procedural 3D station visualization
The central viewport should display a procedurally generated 3D representation of the station.
The visualization should be generated from:
hierarchy.json — defines the component hierarchy and which components are contained within other components.
connection.json — defines the connections between components.
3.5.1 Container geometry
All container types should be represented as boxes that fit their inner components.
The exception is the campus type, which should be represented as a plane underneath the entire model.
Container dimensions should accommodate their inner components.
Container meshes should be translucent so that their internal components remain visible.
3.5.2 Leaf component geometry
Leaf components should have 3D models designed in React Three.
Since the number of supported component types is limited, each supported type should have an appropriate 3D representation.
3.5.3 Floor positioning
Components located on the same floor level should share the same altitude.
Components on different floor levels should be positioned according to their respective floor levels.
3.5.4 Suspended floors and lifts
When two floor levels are not on the same level, the visualization should include four supporting beams at the four corners of the hovering or hanging floor.
Unconnected floors should be connected using a visual lift mesh.
The lift is purely visual and must not be interactable.
3.6 Connection visualization
Connections should be rendered as cuboidal wires rather than simple straight lines.
Each connection should have a visual style based on its type.
Connection type
Color
Relative thickness
Power
Pale red
Slightly thicker
Data
Pale blue
Slightly thinner
Signal
Pale yellow
Thinnest
Resource
Pale green
Thickest

3.6.1 Connection endpoints
Connections must start and end at the walls of the components they connect, rather than at the centers of their meshes.
3.6.2 Pathfinding and obstacle avoidance
Connections should:
Avoid overlapping any components other than their source and target.
Stay within the bounds of the outermost container types.
Clamp to container walls rather than extending outside them.
Follow staircase-like paths instead of direct straight lines.
Move horizontally in only four directions.
Support connections between components on different floor levels.
Connection routing should use 3D A* pathfinding with object avoidance to prevent collisions with unrelated components.
3.6.3 Connection buses
Connections of the same type that travel through the same general area should be merged into a shared bus.
The bus should:
Retain the connection type's color.
Become thicker as connections are merged.
Represent all underlying connections.
Different connection types must not overlap.
Connections of different types may cross one another, but they must not overlap.
3.6.4 Bus interaction
Hovering over or selecting a bus should highlight every connection merged into it.
Selecting a bus should open an inspector that displays all the individual connections contained within it.
3.7 Hover interactions
Hovering over a component or connection should trigger the following behavior.
3.7.1 Hover highlighting
The hovered component or connection should receive:
A yellow overlay.
A highlighted outline around its 3D mesh.
When hovering over a component, all connections associated with that component should be highlighted in a slightly paler yellow.
This applies whether the component is the source or target of the connection.
When hovering over a connection, both connected components should be highlighted in a slightly paler yellow.
3.7.2 Hover information card
A card should appear on the right side, below the station information card.
It should display information about the component or connection currently under the cursor.
3.7.3 Hover-based occlusion
When the Occlusion setting is Off on hover, hovering over a container should make it translucent so that its internal components become visible.
3.7.4 Specific-component targeting
Hover and selection behavior must prioritize the most specific component under the cursor.
The interaction system must not become stuck on outer container components when the user is attempting to interact with an inner component.
3.8 Selection interactions
Selecting a component or connection should produce a persistent selection state until the selection changes or is cleared.
3.8.1 Selection highlighting
The selected component or connection should receive:
A golden overlay.
A highlighted outline around its 3D mesh.
When a component is selected, all connections associated with it should be highlighted in a slightly paler golden color.
When a connection is selected, both connected components should be highlighted in a slightly paler golden color.
3.8.2 Selection inspector
An inspector card should appear on the right side, below the station information card and below the hover card when one is present.
For a selected component, the inspector should display relevant information, including:
Component name and type.
Connected components and connections.
Current values.
Tags.
Backup designation.
Current operational status: active, inactive, or failed.
Component dimensions.
Component position.
For a selected connection, the inspector should display information about the selected connection and its relationship to the connected components.
Current values and operational status displayed by the Digital Twin inspector shall be populated from the latest available telemetry record for the selected station. 
For a selected bus, the inspector should display all the individual connections represented by that bus.
3.8.3 Selection-based occlusion
When the Occlusion setting is Off on hover, selecting a component or connection should also make the relevant containers translucent so that the selected item and its internal context remain visible.
3.8.4 Selection methods
Components should be selectable through either:
Clicking the component in the Hierarchy panel.
Clicking the component's 3D model in the central viewport.
Connections should be selectable through the connection visualization or the Connections panel.
Selection should remain consistent between the hierarchy, 3D viewport, and inspectors.
3.9 Connections panel
The Connections panel should provide a list of all connections defined in the station configuration.
At the top of the panel, provide a sorting menu with three options:
Sort by source.
Sort by target.
Sort by connection type.
3.9.1 Grouped connection lists
Connections should be grouped according to the selected sorting option.
For example, when sorting by source:
Connections from the same source should be grouped beneath the source component's name.
The source group should be expandable and collapsible.
Different source groups should be separated by line breaks.
The same grouping behavior should apply when sorting by target or connection type.
3.9.2 Connection visibility
Each connection should have its own visibility toggle.
Hiding a connection should hide only that connection.
It must not hide the components connected by it.
3.10 Focus control
The Focus button should reset the central 3D view to its default state.
It should reset:
Rotation.
Scaling / zoom.
Drag / pan position.
The resulting view should return to the default camera and viewport configuration.
4. Components
4.1 Purpose and layout
The Components page provides a hierarchical, card-based interface for exploring the station's components.
Initially, the page should display cards representing the outermost components or containers.
Each card should contain relevant information about the component and provide a button for opening its inspector.
4.2 Component cards
Each component card should display:
A picture related to the component.
The component's name.
Its current operational status.
The amount of power it is consuming, where applicable.
A button for opening the component inspector.
The inspector should display the information associated with the selected component.
4.3 Hierarchical navigation
When a user clicks a container-type component card, the page should navigate into that component's inner hierarchy level.
The current cards should be replaced with cards representing the components inside the selected container.
The transition between hierarchical levels should use a fading animation.
A navigation button should appear above the component cards to return to the previous hierarchical component.
This navigation should allow users to move through the station's hierarchy without losing the relationship between the current level and its parent.
5. Connections
5.1 Purpose and layout
The Connections page provides a graphical view of the station's entire connection topology.
The topology should be generated using the simulation's connection data and the station's component hierarchy.
5.2 Graph structure
Components should be represented as rectangles.
Components contained within other components should appear inside the rectangle of their respective parent component.
The graph should represent the full hierarchy of the station.
Component names should be displayed above their corresponding shapes.
5.3 Connection rendering
Connections should be generated according to connection.json.
Each connection should connect the appropriate source and target components.
Connections should start and end at the walls of the component rectangles rather than at their centers.
Connection colors and relative thicknesses should follow the Digital Twin connection scheme:
Connection type
Color
Relative thickness
Power
Pale red
Slightly thicker
Data
Pale blue
Slightly thinner
Signal
Pale yellow
Thinnest
Resource
Pale green
Thickest

5.4 Hover and selection
Connections should support hover and selection interactions.
When a connection is hovered over or selected, it should receive a golden highlight.
Clicking a connection should open its inspector on the right side of the page.
The inspector should display the information associated with the selected connection.
5.5 Zoom and navigation
A Focus button should be positioned at the bottom-right of the graph.
Clicking it should reset the graph's zoom and drag/pan position.
The graph should support zooming and dragging.
Zooming out should have a limit: users must not be able to zoom out beyond 3.5 times the full graph's size.
5.6 Component labels
Component names should behave similarly to labels in Google Maps.
Inner component names should become invisible when zooming out.
Component names should become larger and more contrasting as their hierarchical level increases.
The outermost component's name should always remain visible.
This behavior should keep the graph readable without overcrowding it with labels when the entire station is viewed at once.
6. History and Diagnostics
6.1 Purpose
The History and Diagnostics page provides access to historical telemetry persisted in the telemetry database for the selected Antarctic research station.
The page shall allow users to inspect how the station's components, connections, and external conditions changed over time. Historical information shall be retrieved from persisted telemetry records rather than from the current in-memory simulation state.
The page shall support both physical station telemetry and simulation-generated telemetry. Simulation telemetry shall be clearly distinguishable from telemetry originating from physical station systems.
For simulation-generated telemetry, the simulation run identifier shall allow users to reconstruct the telemetry history of a particular execution independently from other executions of the same scenario.
6.2 Core capabilities
The History and Diagnostics page shall allow users to:
Select a station or digital twin.
Select a historical time range.
Select a simulation run where applicable.
View historical telemetry records.
Inspect component values over time.
Inspect component status changes.
Inspect connection status changes.
Inspect external-field changes.
View simulation timestamps.
View the corresponding real-world persistence timestamps.
Distinguish simulated telemetry from physical station telemetry.
Inspect the telemetry associated with a particular simulation run.
Compare the state of components, connections, and external fields at different points in time.
Historical data shall always be retrieved from the telemetry database.
The page shall not use the current in-memory simulation state as the source for historical records.
6.3 Telemetry source and record information
Each telemetry record displayed by the page shall expose sufficient metadata to identify the origin and temporal context of the record.
The telemetry record shall support displaying:
Field
Description
Station / Model
Station or digital-twin model associated with the telemetry record.
Simulation Run
Unique simulation/scenario execution identifier, where applicable.
Telemetry Source
Identifies whether the record originated from a simulation or a physical station system.
Simulation Timestamp
Time represented by the simulated station state, where applicable.
Persistence Timestamp
Real-world timestamp at which the telemetry record was persisted.
Components
Component state and measured values represented by the record.
Component Statuses
Component operational statuses represented by the record.
Connection Statuses
Operational status of the station connections.
External Fields
External environmental, network, and supply state represented by the record.

The distinction between simulation time and persistence time shall remain visible when viewing simulation-generated telemetry.
Simulation timestamps represent the time within the simulated environment, while persistence timestamps represent when the corresponding telemetry record was stored in the real world.
6.4 Main layout
The History and Diagnostics page should use a workspace layout consisting of:
Page header and telemetry filters.
Historical telemetry timeline.
Telemetry record/state view.
Component history panel.
Connection history panel.
External-field history panel.
Diagnostics and metadata panel.
The historical timeline and primary telemetry visualization should receive the greatest visual emphasis.
Detailed component, connection, external-field, and metadata information should be displayed in secondary panels so that the page remains readable while allowing detailed inspection.
6.5 Header and filters
At the top of the page, display the selected station name and the controls required to determine which historical telemetry is displayed.
The filter area shall contain:
Station
A station/model selector shall allow the user to select the station whose historical telemetry is being inspected.
The selected station should remain consistent with the station selected in the global navigation.
Time range
Provide controls for selecting the historical time range.
The user should be able to specify:
Start time.
End time.
The selected range shall determine which persisted telemetry records are displayed.
Telemetry source
Provide a filter for the telemetry source.
The available source categories shall distinguish at minimum:
Physical station telemetry.
Simulation telemetry.
Simulation run
When simulation telemetry is selected, provide a simulation-run selector.
The selector shall list the simulation runs associated with the selected station and selected historical data.
Each run should display its identifying information, including its unique run identifier.
The simulation-run filter shall allow the user to inspect one simulation execution independently from other executions of the same scenario.
6.6 Historical telemetry timeline
The primary area of the page should provide a time-oriented representation of the selected telemetry.
The timeline should allow users to:
Navigate through the selected historical time range.
Select an individual telemetry record.
Identify changes in component values.
Identify component status transitions.
Identify connection status transitions.
Identify external-field changes.
Distinguish simulation time from persistence time when simulation telemetry is selected.
The timeline may use a time-series visualization, event markers, or another equivalent chronological representation.
When a telemetry record is selected, the corresponding state should be displayed in the telemetry detail area.
For simulation telemetry, the timeline shall preserve the relationship between the simulation timestamp and the real-world persistence timestamp.
6.7 Telemetry record table
The page should provide a tabular representation of the historical telemetry records.
Each row should represent one persisted telemetry record.
The table should display, where applicable:
Column
Information
Simulation Time
Timestamp represented by the simulated station state.
Persistence Time
Real-world time at which the record was persisted.
Source
Simulation or physical station telemetry.
Simulation Run
Simulation run identifier, where applicable.
Station / Model
Station associated with the record.
Components
Summary of component state/value information.
Connections
Summary of connection-state information.
External Fields
Summary of external-field state.

Users should be able to select a row to inspect the complete telemetry state represented by that record.
6.8 Component history
The component history view shall allow users to inspect component values and status changes over time.
Users should be able to select a component and view:
Component name.
Component type.
Historical values.
Value changes over time.
Operational status.
Status transitions.
Simulation timestamp.
Persistence timestamp.
Telemetry source.
Simulation run, where applicable.
Component values shall be displayed using their canonical units as defined by the station model.
The view may use a time-series graph for continuously changing values and an event/change list for discrete status transitions.
For example, a component history may show:
active → failure → active
alongside the timestamps at which each transition occurred.

6.9 Connection history
The connection history view shall allow users to inspect changes to the operational status of station connections.
Users should be able to select a connection and inspect:
Source component.
Target component.
Connection type.
Historical connection status.
Status transitions.
Simulation timestamp.
Persistence timestamp.
Telemetry source.
Simulation run, where applicable.
Connection statuses shall use the supported operational states:
active
inactive
failure
The history view should make status transitions visually identifiable.
6.10 External-field history
The external-field history view shall allow users to inspect historical changes to external simulation conditions.
External telemetry shall support the groups defined by the simulation model:
Weather.
Network.
Supplies.
Weather history may include fields such as:
Temperature.
Wind speed.
Humidity.
O₂ level.
CO₂ level.
Wind direction.
Visibility.
Pressure.
Dew frost point.
Network history may include:
Bandwidth.
Mainland connectivity.
Upload window.
Upload speed.
Download speed.
Supply history may include:
Supply ETA.
Supply description.
Transportation mode.
The page should display changes to these fields chronologically and associate them with the corresponding telemetry timestamps.
6.11 Simulation run reconstruction
When viewing simulation-generated telemetry, the simulation run identifier shall be treated as a primary filter for reconstructing a simulation execution.
Selecting a simulation run shall restrict the historical view to telemetry generated by that specific execution.
Telemetry generated by another execution of the same scenario shall not be mixed into the selected run's history.
The page should display the selected simulation run identifier prominently so that users can determine which simulation execution they are inspecting.
The reconstructed history shall be based on the telemetry records persisted for that run rather than the current state of the simulation engine.
6.12 Simulation time and persistence time
Simulation-generated telemetry has two distinct temporal concepts:
Simulation timestamp — the time represented by the simulated station state.
Persistence timestamp — the real-world time at which that telemetry record was persisted.
Both timestamps shall be displayed where applicable.
The interface should make the distinction visually clear and should not treat the persistence timestamp as a replacement for simulation time.
At the standard simulation playback rate, one real-world second corresponds to one simulation tick, with each tick representing 15 simulation seconds. Therefore, telemetry records generated at the standard playback rate represent successive simulation states at the simulation tick resolution.
6.13 Telemetry source indication
Every telemetry record shall have a visible source indicator.
The interface shall distinguish:
Simulation — telemetry generated by the simulation engine and persisted to the telemetry database.
Physical — telemetry originating from physical station systems.
The source indicator should be visible in the telemetry table, record inspector, and relevant historical visualizations.
When simulation telemetry is being displayed, the associated simulation run identifier should also be visible.
6.14 Telemetry record inspector
Selecting a telemetry record should open a telemetry inspector.
The inspector should display:
Station/model.
Telemetry source.
Simulation run identifier, where applicable.
Simulation timestamp, where applicable.
Persistence timestamp.
Component states and values.
Component statuses.
Connection statuses.
External fields.
The inspector should provide the complete state represented by the selected persisted telemetry record rather than the current runtime state of the simulation.
6.15 Diagnostics
The diagnostics area should provide information useful for understanding historical telemetry and identifying gaps or changes in the persisted record stream.
Where applicable, it should display:
Number of telemetry records in the selected range.
Selected simulation run.
Telemetry source.
First available record.
Last available record.
Missing or unavailable historical data.
Selected record timestamp information.
If no historical telemetry exists for the selected station, time range, or simulation run, the page shall clearly indicate that no persisted telemetry is available.
The page must not substitute current runtime state for missing historical telemetry.
6.16 Data source requirements
Historical telemetry shall be retrieved from the telemetry database.
The current simulation files represent runtime state and shall not be treated as the historical source.
In particular:
component.json represents the current runtime component state.
The simulation connection.json represents the current runtime connection state.
external.json represents the current runtime external conditions.
The telemetry database contains persisted historical telemetry records.
The History and Diagnostics page shall therefore query persisted telemetry records when displaying historical information.

6.17 Interaction with other pages
The History and Diagnostics page should integrate with the Digital Twin, Components, Connections, and Scenario / Simulation pages.
Selecting a component, connection, or simulation run from another page should allow the user to open the corresponding historical information where practical.
Similarly, users should be able to use historical records to identify a component or connection and navigate to its corresponding current inspector or Digital Twin representation.
Historical inspection must remain independent of the current runtime state: opening a historical record must not replace the current station state with the historical state.
6.18 Recommended visual structure
The page should follow this general arrangement:

History and diagnostics

Station: [station >] Source: [All >] Run: [Run >]
Time[Start] —--------------------------------------------[end]   [Apply]


Historical Timeline
Simulation Time —-----------------------------------------------
Persistence Time —------------------------------------------------

Component status changes
Connection changes
External-field changes
Telemetry records
Historical Telemetry
Selected Record

Station/Model
Source
Simulation Run
Simulation Time
Persistence Time
Time
Source
Run
Status
12:00:00
sim
R-001
…
12:00:15
sim
R-001
…
12:00:30
sim
R-001
…
…
Component History
Connection History
External Fields
Diagnostics
Selected components/connections/external-field time-series

The primary workflow should therefore be:
Select station → select source → select time range → select simulation run if applicable → inspect timeline/table → select record or component → inspect historical values and status changes.
7. Scenario / Simulation
7.1 Purpose
The Scenario/Simulation page is the workspace for creating, editing, organizing, running, and inspecting simulation scenarios for the selected Antarctic research station.
A scenario is defined using a .scene file, which references reusable .event files.
The interface should provide both:
A visual interface for creating and editing scenario events.
A source editor for viewing and editing the underlying DSL.
The page should integrate scenario authoring with simulation execution and monitoring, while keeping these activities visually distinct enough to avoid overcrowding.
7.2 Core capabilities
The page should allow users to:
Configure the initial simulation state before execution 
Create, rename, duplicate, and delete scenario files.
Add events from the available event definitions.
Configure event start times and durations.
Select the components, connections, or external fields affected by events.
Configure fields that the event definition permits them to modify.
View the current station state while the simulation runs.
Run, pause, resume, step through, and reset a simulation.
Inspect the effects of events on components, connections, external conditions, and the station as a whole.
View automatic state changes produced by the simulation engine.
Inspect validation errors and invalid event configurations before execution.
The page should integrate with the Digital Twin, Components, Connections, and History and Diagnostics pages.
Users must be able to inspect components and connections affected by events without manually searching for them elsewhere.
7.3 Main layout
The Scenario/Simulation page should contain the following areas:
Top bar with the selected scenario and simulation controls.
Scenario library.
Event library.
Timeline editor.
Event inspector.
Simulation monitor.
Simulation log and diagnostics.
DSL source editor.
The timeline and simulation monitor should receive the greatest visual emphasis.
The event library and event inspector should be placed in collapsible side panels.
The simulation log and DSL editor should be placed in collapsible bottom panels to avoid permanently consuming too much screen space.
7.4 Scenario library
The scenario library should contain all .scene files available for the selected station/model.
Each scenario should be represented by a row or card displaying:
Scenario name.
Short description, if available.
Number of events.
Total simulation duration, if determinable.
Current save state.
Validation-error indicator.
Scenario management
The library should support:
Creating a new scenario.
Opening an existing scenario.
Renaming a scenario.
Duplicating a scenario.
Deleting a scenario.
When creating a scenario, users should be able to start with either an empty .scene file or a duplicate of an existing scenario.
Duplicating a scenario must create an independent scenario file. Editing the duplicate must not modify the original.
Deleting a scenario must require confirmation.
The currently selected scenario should be clearly highlighted in the library.
7.5 Top bar and simulation controls
The top bar should contain:
Scenario selector.
Current simulation time.
Simulation status.
Play button.
Pause button.
Step-forward button.
Reset button.
Simulation speed selector.
Save indicator.
Validation indicator.
Initial Simulation State
Before a simulation is started, the Scenario / Simulation page shall allow the user to configure the initial state of the simulation.
The initial state shall support configuration of:
Components
operational status
current values
other mutable fields permitted by the component specification
Connections
connection status
External Fields
weather values
network values
supply values
other mutable fields defined by the external-data model
The configured initial state becomes the starting state of the simulation at:
simulation time = 0
The initial state shall be validated against the digital-twin model and applicable specifications before the simulation starts.
Fields that are not explicitly configured shall use their defined default or baseline values.
Initial state configuration is separate from scenario events. The initial state defines the condition at simulation time zero, while .event entries define state changes occurring during the simulation.
7.5.1 Simulation status
The simulation status should distinguish between the following states:
Status
Meaning
Ready
The scenario is loaded but not started.
Running
The simulation is advanced.
Paused
The simulation is stopped at its current time and can be resumed.
Completed
The simulation has reached its configured end time.
Error
An error has occurred that prevents the simulation from continuing.

The current simulation time must be displayed separately from the scenario's total duration.
Telemetry status
Status
Meaning
Not Publishing
The simulation is not publishing the generated data as telemetry data.
Publishing
The simulation is publishing the generated data as telemetry in the database.
Stopped
The data is stopped from being stored as persistent data in the database.

When enabled, the current simulation state is published through the station telemetry pipeline and persisted as telemetry data.
Also, because this is simulated rather than physically measured data, the database should retain a source indicator such as:
	source = SIMULATION
while actual station data can later use:
	source = LIVE
This prevents the History page from silently mixing synthetic and physical measurements.
7.5.2 Playback speed
The speed selector should control how quickly simulation time advances relative to real time.
Changing playback speed must not change:
Event ordering.
Event durations.
The underlying scenario timeline.
Simulation Playback
The simulation executes using discrete simulation ticks.
The default playback rate is:
	1 real-world second = 1 simulation tick = 15 simulation seconds
Therefore:
240 simulation ticks = 1 simulation hour
The Simulation page shall provide playback controls including:
Play
Pause
Step
Reset
Playback Speed
Playback speed controls how quickly simulation ticks are processed relative to wall-clock time. It must not modify the simulation timeline, event timestamps, event durations or event ordering.
For example, increasing the playback speed may cause multiple simulation ticks to be processed during one real-world second, while decreasing the playback speed may cause fewer ticks to be processed during one real-world second.
The simulation remains defined by its simulation clock regardless of playback speed.
7.5.3 Step-forward
The Step-forward button should advance the simulation by one simulation step while preserving the normal event ordering and simulation rules.
7.5.4 Reset
The Reset button should return the simulation to its initial state and simulation time.
It should:
Clear temporary event effects.
Restore the initial component values and states.
Restore the initial connection values and states.
Restore the initial external conditions.
The reset operation must require confirmation if the simulation is running or if resetting would discard unsaved simulation results.
7.5.5 Save and validation indicators
The save indicator should show whether the selected .scene file has unsaved changes.
The validation indicator should show whether the scenario has been validated and is ready to run.
The interface must not treat a scenario as valid simply because it can be displayed on the timeline.
7.6 Event library
The Event library should contain the available event definitions from the .event files.
Each event type should be displayed as a card or list item containing:
Event name.
Short description.
Target type: component, connection, or external field.
Fields it can modify.
Whether it requires additional configuration in the .scene file.
7.6.1 Supported event types

Event
Purpose
failure
Sets the status of selected components to failure.
failure_except_backup
Sets the status of selected non-backup components to failure.
network_outage
Changes network conditions to represent an outage.
connection_failure
Sets selected connections to failure.
fix_connection
Sets failed connections back to active.
set_external
Changes selected fields in the external configuration.
set_component
Changes selected fields of a component.

7.6.2 Adding events
Users should be able to add an event to the timeline in either of two ways:
Drag an event type from the Event library onto the timeline.
Click an event type to add it to the timeline.
When an event is added, the event inspector should open so the user can configure it.
The Event library must not directly modify the simulation state.
It should only provide event definitions that can be instantiated in the selected .scene file.
7.7 Timeline editor
The Timeline editor is the main area for creating, arranging, and inspecting scenario events.
It should display simulation time horizontally, with each event represented by a bar showing its start time and duration.
7.7.1 Timeline controls and elements
The timeline should include:
Horizontal time axis.
Playhead indicating the current simulation time.
Event tracks.
Zoom control.
Horizontal scrolling.
Event selection.
Event movement.
Event resizing.
Event deletion.
Event creation from the Event library.
7.7.2 Event bars
Each event should appear as a bar extending from its at= time to the end of its for= duration.
For example, an event with at=1.0 and for=2.0 should begin at simulation time 1.0 and end at simulation time 3.0.
Events with different purposes should be visually distinguishable, including:
Component failures.
Connection failures.
External condition changes.
Component value changes.
Each event bar should display the event name and, when space permits, its target.
Selecting an event should highlight its bar and display its configuration in the event inspector.
7.7.3 Infinite-duration events
An event with for=inf has no scheduled end time.
It should:
Extend to the end of the visible timeline.
Use a distinct visual treatment to indicate its indefinite duration.
Not be displayed as an ordinary finite-duration event with an arbitrary end time.
7.7.4 Moving and resizing events
Users should be able to:
Drag an event horizontally to change its at= value.
Resize the end of a finite-duration event to change its for= value.
Moving or resizing an event should update the corresponding values in the .scene file.
The timeline should support zooming in and out so users can inspect events occurring close together as well as events spread across long simulation periods.
7.7.5 Overlapping events
The timeline must support overlapping events.
Events affecting the same component or field should remain separately visible and selectable, even when their bars overlap.
The interface must preserve the ordering of events in the .scene file when events share the same at= timestamp.
Events should be evaluated in ascending order of their at= values.
When two events have the same at= timestamp, the event appearing first in the .scene file must be instantiated first. This is equivalent to a stable sort based on at=.
7.7.6 Timeline navigation
The timeline should support:
Clicking an event to select it and open its inspector.
Inspecting an event's component or connection target in the Digital Twin.
Moving the playhead as the simulation advances.
Dragging the playhead to another simulation time while paused, provided the simulation engine supports seeking or replaying to that point.
Jumping to the next scheduled event.
Jumping to the previous scheduled event.
Jumping directly to the start time of the selected event.
When seeking is supported, the simulation monitor should display the state corresponding to the selected simulation time.
7.8 Event inspector
The Event inspector should appear when an event is selected from the timeline.
It should display the event configuration and allow users to edit only the fields permitted by the corresponding .event definition.
7.8.1 Inspector contents
The inspector should contain:
Event type.
Event target.
Start time (at=).
Duration (for=).
where filters, if applicable.
set fields and values, if applicable.
Preview of affected components, connections, or external fields.
Validation errors and warnings associated with the event.
The inspector should be context-sensitive. Its available fields should depend on the selected event type and the target type it operates on.
7.9 Target selection
Users should be able to select event targets through a visual picker rather than manually entering every reference.
7.9.1 Component targets
For component-targeted events, the target picker should allow users to select:
A component by its globally unique name.
A component type, selecting all components of that type.
A combination of component name and component type, where supported by the event definition.
The component picker should use the hierarchy defined in hierarchy.json, allowing users to browse the station and select relevant components.
7.9.2 Connection targets
For connection-targeted events, the target picker should allow users to select connections using:
Source component.
Connection type.
Target component.
The picker should use the connections defined in the simulation's connection.json.
7.9.3 External targets
For external-targeted events, the target picker should allow users to select the relevant external category or field, including:
Weather.
Network.
Supplies.
7.9.4 DSL reference generation
The interface should generate the corresponding .scene reference using the syntax defined for the selected event type.
The visual picker must not generate unsupported references.
7.10 where filters
If an event definition contains a where clause, the event inspector should expose the applicable filters.
The interface should provide a visual filter builder using only the fields and expressions supported by the event DSL.
7.10.1 Component filters
For component targets, users should be able to filter by:
is_backup
status
Component value fields, such as value.temperature.
Where supported by the DSL, users should also be able to filter components based on their connections.
7.10.2 Connection filters
For connection targets, users should be able to filter by:
Connection type.
Source component properties.
Target component properties.
Connection status.
7.10.3 Filter builder and DSL
The interface should allow users to:
Construct filters visually.
View the generated DSL expression.
Edit the DSL expression directly.
The filter builder must not expose unsupported fields or operators.
7.11 set fields
The Event inspector should display the fields that can be modified by the selected event.
All editable fields must follow the corresponding .event definition.
For example, a set_component event should only expose fields permitted by its set clause.
Fields fixed inside the event definition must not be editable through the scenario inspector.
7.11.1 Field categories
The interface should distinguish between:
Fields whose values are fixed by the .event file.
Fields whose values can be configured in the .scene file.
Fields that cannot be modified.
The is_backup field must never be editable through the Event inspector because it is immutable.
7.11.2 Units and canonical values
The inspector should display values in their appropriate units where applicable.
Values written to the simulation configuration must use the expected canonical representation.
8. Simulation Monitor
8.1 Purpose
The Simulation monitor displays the current state of the station as the simulation runs.
It should be integrated with the Digital Twin 3D view so that users can observe the operational state of components and connections at the current simulation time.
The monitor should display:
Station status overview.
Component status summary.
Connection status summary.
Relevant external conditions.
Current values for important component measurements.
Currently active events.
Upcoming events.
The monitor should update as the simulation advances.
Its displayed state should be derived from the simulation's current component.json, connection.json, and external.json data.
8.2 Component status
Components should be visually distinguished according to their current simulation status:
active
inactive
failure
The monitor should use the same status conventions as the Digital Twin and Components pages.
8.2.1 Component inspection
Selecting a component in the monitor should open its inspector, showing:
Current values.
Current status.
Backup designation.
Relevant connections.
Ancestors and children in the hierarchy.
8.2.2 Hierarchical status
If an outer component is inactive or failed, its inner components should be represented according to the simulation's hierarchy rules.
The interface must not imply that an inner component is functioning independently when an inactive or failed ancestor prevents it from functioning.
8.3 Connection status
The monitor should distinguish between connections that are:
active
inactive
failure
Connection visuals should follow the same type-based colors and relative thicknesses used by the Digital Twin and Connections pages.
Connection type
Color
Relative thickness
Power
Pale red
Slightly thicker
Data
Pale blue
Slightly thinner
Signal
Pale yellow
Thinnest
Resource
Pale green
Thickest

Selecting a connection should open an inspector showing:
Source.
Target.
Connection type.
Current status.
If a data connection is inactive, the monitor should clearly indicate that transmitted data may be missing.
The interface should account for the simulation model's handling of missing data through extrapolation from other available data or previously valid values.
8.4 External conditions
The monitor should display the current external conditions from external.json.
External conditions should be organized into three categories.
8.4.1 Weather
Display the available weather values, including:
Temperature.
Wind speed.
Humidity.
Oxygen level.
Carbon dioxide level.
Wind direction.
Visibility.
Pressure.
Dew frost point.
8.4.2 Network
Display:
Bandwidth.
Mainland connectivity.
Upload window status.
Upload speed.
Download speed.
8.4.3 Supplies
Display the available supply information, including:
Estimated arrival time.
Transportation mode.
Description.
8.4.4 Event-driven external changes
When an event changes an external field, the monitor should:
Update the displayed value.
Indicate that the value is being affected by an event.
Distinguish the initial configured value from the current simulation value.
9. Event Effects and Automatic Simulation Behavior
9.1 Scheduled versus automatic changes
The Scenario/Simulation page should distinguish between changes explicitly caused by scheduled scenario events and changes automatically produced by the simulation engine.
Not every state change originates from a scheduled event.
Components may change their statuses or operational values because of the simulation's default behavior and the station's current conditions.
The monitor and event log should identify whether a change was caused by:
A scheduled scenario event.
Automatic backup activation.
Automatic component activation or deactivation.
Resource demand or resource shortage.
A component exceeding its allowed rating and tolerance.
A parent component becoming inactive or failing.
A connection becoming inactive or failed.
Another simulation-engine rule.
The interface should not require users to manually schedule events for automatic behavior already defined by the simulation engine.
9.2 Backup components
Backup components should be visually distinguishable from ordinary components.
The monitor should show whether a backup component is:
Inactive.
Active.
Explicitly activated by a scenario event.
When automatic backup activation occurs, the interface should explain the reason.
Backup components normally remain off until at least one component of the same type is active.
A backup component automatically turns on when all other components of the same type become inactive or failed.
Users should be able to inspect the event or simulation condition that caused a backup component to change state.
9.3 Component values and tolerance
The monitor should display component values in their canonical units, using an appropriate display unit for the user.
The interface should indicate when a component value is approaching or exceeding its rating range.
It should distinguish between:
A component value temporarily operating outside its intended range.
A component actually entering failure status.
If a component exceeds its rating and tolerance and subsequently fails, the event log should record the automatic state transition.
The global tolerance and component-specific tolerance should be respected by the simulation engine.
If tolerance values are exposed in the interface, the component-specific and global values should be clearly distinguished so users can understand how they contribute to the effective tolerance.
9.4 Active events and overlapping changes
The monitor should provide a list of events currently active in the simulation.
Each active event should display:
Event type.
Target.
Start time.
Scheduled end time, if finite.
Remaining duration, if finite.
Fields or statuses being affected.
Users should be able to select an active event to highlight it on the timeline and open its inspector.
When multiple events affect the same field, users should be able to inspect the active event stack.
The simulation engine's event semantics must be preserved.
When multiple finite-duration events modify the same field, values should revert according to the event stack as events expire, taking other still-active events into account.
Events with for=inf should be represented as indefinite changes rather than ordinary finite-duration events.
10. Simulation Log
10.1 Purpose
The Simulation log should display a chronological record of important simulation events and state changes.
It should include:
Scenario events being instantiated.
Events reaching their end time.
Temporary values being restored.
Indefinite changes being applied.
Automatic component status changes.
Backup component activation.
Connection status changes.
Component failures caused by rating and tolerance violations.
Resource shortages and resulting component deactivation.
Validation errors.
Simulation errors.
10.2 Log entries
Each log entry should display:
Simulation timestamp.
Concise description of what happened.
Affected component, connection, or external field, where applicable.
10.3 Log interactions
Users should be able to click a log entry to:
Jump to the corresponding time on the timeline.
Highlight the affected component or connection in the Digital Twin.
Open the relevant inspector.
Inspect the responsible event, if the change originated from a scheduled event.
10.4 Filtering and visual distinction
The log should visually distinguish between:
Scheduled events.
Automatic simulation changes.
Warnings.
Errors.
It should support filtering by:
Event type.
Affected component.
Connection.
Severity.
11. Validation and Diagnostics
11.1 Purpose
Before a scenario is run, the page should validate its .scene file against the available .event definitions and the current station configuration.
Validation must be based on the actual DSL definitions and configuration.
11.2 Validation checks
The validation system should check:
Whether the referenced event definition exists.
Whether the event's target syntax is valid.
Whether the target refers to valid components, connections, or external fields.
Whether at= and for= values are valid.
Whether the event's where clause is supported.
Whether the set clause contains only fields permitted by the event definition.
Whether assigned values are valid for the corresponding fields.
Whether the scenario contains unresolved references.
11.3 Diagnostics panel
Validation errors should be displayed in a dedicated diagnostics panel.
Each error should identify:
The affected event.
The relevant field or DSL location.
The validation problem.
Users should be able to click an error to select the corresponding event and open its inspector or the relevant DSL source location.
Warnings should be visually distinguished from errors.
Warnings should not automatically prevent the scenario from running unless the simulation engine requires it.
The interface must not claim that a scenario is valid merely because it can be displayed on the timeline.
12. DSL Source Editor
12.1 Purpose
The page should provide a source editor for the selected .scene file.
Users should be able to view and edit the scenario using the .scene syntax defined in the specification.
12.2 Editor features
The source editor should support:
Syntax highlighting.
Indentation.
Line numbers.
Validation error markers.
Highlighting of the currently selected event.
Navigation between an event on the timeline and its source declaration.
The editor should also provide a way to inspect the corresponding .event definition for the selected event instance.
12.3 Synchronization with the visual editor
The visual timeline and source editor must remain synchronized.
When users modify an event's time, duration, target, or configurable values through the visual editor, the corresponding .scene source should update.
When users edit the .scene source directly, the timeline should update after the source has been successfully parsed.
If the source contains syntax errors:
The editor should display the errors.
The user's text should be preserved.
Invalid edits must not be silently discarded.
The visual editor should only expose operations supported by the DSL.
It must not generate unsupported fields or alter an event's meaning when converting between the visual editor and the source representation.
13. Scenario Execution
13.1 Initialization
When the user starts a simulation, the page should load the selected scenario and initialize the simulation using the station's configuration.
The simulation should use:

File
Purpose
component.json
Component states and values.
connection.json
Simulation connection states.
external.json
External conditions.
Selected .scene file
Scheduled scenario events.
Corresponding .event files
Event definitions.

The initial simulation state should be based on the configured component, connection, and external values.
13.2 Execution behavior
The simulation should advance according to the scenario timeline and the simulation's default rules.
The page should:
Display the current simulation time.
Update the monitor as the state changes.
Allow users to pause and resume without losing the current state.
Allow users to step through the simulation to inspect individual events and automatic changes.
14. Scenario Comparison
14.1 Purpose
An optional scenario comparison feature may be included.
It should allow users to compare the results of two scenarios using the same station configuration.
14.2 Comparison data
The comparison should show differences in:
Component statuses.
Connection statuses.
Component values.
External conditions.
Event timing.
Automatic state changes.
Simulation errors and warnings.
14.3 Comparison interactions
Users should be able to inspect a difference and jump to the relevant component, connection, or timeline position.
The interface must clearly identify which scenario each result belongs to.
It must not merge the states of the two simulations into a single ambiguous station state.
15. Integration with the Digital Twin
The Scenario/Simulation page should reuse the existing Digital Twin 3D view rather than creating an unrelated 3D visualization.
15.1 Simulation state integration
When the simulation monitor is active, the Digital Twin should reflect the state of the selected simulation.
Components and connections should retain the hover and selection behaviors described in the Digital Twin section.
15.2 Event and log navigation
When a user selects an event or log entry, the corresponding component or connection should be highlighted in the 3D view.
When a user selects a component or connection in the 3D view, the page should provide a way to inspect the events affecting it.
15.3 Navigation persistence
Users should be able to move between the Scenario/Simulation page and the Digital Twin without losing the currently selected scenario or simulation state.
The hierarchy, connection, and component inspectors should remain consistent across the application.
16. Recommended Scenario/Simulation Workspace Arrangement
The recommended layout is a workspace-style interface.

                                                                      Top bar
Scenario selector · Validation · Simulation time · Playback controls · Save state · Telemetry Status
Left Panel
—
Scenario Library
—
Event library

Collapsible
                               Simulation monitor
Digital Twin 3D view · Station conditions · Component and connection states
Right panel
—
Event inspector
—
Component/connection inspector

Context sensitive collapsible

                              Timeline editor
Time axis · Playhead · Event tracks · Event bars

                                                      Bottom Collapsible Panel
                                     Simulation log · Diagnostics · DSL source editor

The left and right panels should be collapsible so users can allocate more space to the timeline or 3D monitor when needed.
The timeline should remain easily accessible while the simulation is running, allowing users to compare the current simulation time with scheduled and active events.
The simulation monitor should remain visually connected to the timeline so users can understand how the station's state corresponds to events occurring at a given time.
17. Overall Design Principles
The frontend should follow these principles throughout the application:
1. Consistent interaction: Component, connection, hierarchy, status, and inspector behaviors should remain consistent across the Digital Twin, Components, Connections, and Scenario/Simulation pages.
2. Hierarchical navigation: Users should be able to move between station-wide views and individual components without losing their context.
3. Clear operational state: Active, inactive, and failed components and connections should be distinguishable throughout the application.
4. Visual clarity: The interface should prioritize important operational information while allowing detailed information to be accessed through inspectors and collapsible panels.
5. Interactive exploration: Users should be able to inspect components and connections directly from the 3D view, hierarchy, topology graph, event timeline, and simulation log.
6. Source and visual editor synchronization: The visual scenario editor should make .scene and .event files easier to create and understand without changing their underlying semantics.
7. Simulation accuracy: The monitor should reflect actual simulation data and distinguish scheduled event effects from automatic simulation behavior.
8. Preservation of context: Navigation between pages should preserve the selected station, relevant selections, and the active scenario/simulation state wherever applicable.
The Scenario/Simulation page should ultimately connect what users schedule, when it happens, what it affects, and how the station responds—while keeping the underlying DSL and simulation rules authoritative.