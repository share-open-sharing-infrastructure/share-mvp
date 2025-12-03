# Intro
This file documents conceptual questions, diagrams are written in [Mermaid](https://mermaid.js.org/).

# Class diagrams
```mermaid
---
title: Base data structure
---
classDiagram
    direction LR

    class User{
        +string username
        +String email
    }
    User -- User : trusts

    class Item{
        +string name
        +Image image
        +string description
        +string place
    }
    User --> Item : owns/lends

    Community --> User : has
    class Community{
        +string name
    }

    class message{
        +string messageContent
        +User from
        +User to
        +date created
    }
    message "1" -- "2" User
```

# Sequence diagrams
These hold all sequenced logic
## Borrowing request

```mermaid
sequenceDiagram
Borrower->>Lender: Request item for time-frame X
Lender->>Borrower: Accept
Borrower->>Lender: Acknowledge

```

# Flow charts
```mermaid
flowchart LR
    start{Start} --> request["Request Item (from, to)"]
    request --> lendResponse{Lender Response}
    lendResponse --> reject[Reject] --> stop{Stop}
    lendResponse --> accept[Accept]
    accept --> notify[Notify borrower]
```