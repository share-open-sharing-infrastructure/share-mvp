# Domain Model

This file documents conceptual questions.

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
    User --> User : trusts

    class Item{
        +string name
        +Image image
        +string description
        +string place
        +User owner <!-- this is currently misnamed, have to adapt in DB and then in code -->
        +bool trusteesOnly
    }
    User "1" <-- "n" Item : owned by

    class message{
        +string messageContent
        +User from
        +User to
        +date created
    }
    message "n" --> "2" User
```

## User entity

- A user can "trust" 0 to n users. Building on this, they can select some of their items to only be visible to their "trustees".

## Item

- "trusteesOnly" is true when the item owner wants to lend this item only to persons they declared as trusted, and otherwise false.
