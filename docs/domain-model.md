# Domain Model

This file documents conceptual questions.

# Class diagrams

## Base data model

```mermaid

classDiagram
    direction LR

    class User{
        +string username
        +string email
        +trusts UserId[]
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

    class Message{
        +string messageContent
        +User from
        +User to
    }

    class Conversation{
        +User requester
        +User itemOwner
        +Item requestedItem
        +Message[] messages
        +boolean readByRequester
        +boolean readByOwner
    }
    Conversation "1" --> "n" Message
    Conversation "0...*" --> "2" User
    Conversation "1" --> "1" Item
```

## User entity

- A user can "trust" 0 to n users. Building on this, they can select some of their items to only be visible to their "trustees".

## Item

- "trusteesOnly" is true when the item owner wants to lend this item only to persons they declared as trusted, and otherwise false.

## Conversation

- A conversation brings together an item for which a request has been made, two users (the requester and the owner of the requested item), and a set of messages that were exchanged between the two users regarding that request.
- The conversation stores if it has been read by either party to enable notifications and an "unread" inbox.
