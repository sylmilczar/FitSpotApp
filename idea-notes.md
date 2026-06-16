# MVP – FitSpotApp for a Small Fitness Club

## Project Overview

A web application that allows clients to browse available fitness classes and reserve spots online.

The system is designed for a single fitness club that currently manages bookings through phone calls, social media messages, or other manual communication channels.

The goal is to simplify the booking process for both clients and club staff.

---

## Main Problem

Many small fitness clubs still manage class registrations manually.

Clients often struggle to find answers to basic questions:

* What classes are available?
* When do they take place?
* Are there any spots left?
* How can I reserve a spot?

Information is frequently scattered across websites, Facebook pages, Messenger conversations, phone calls, or text messages.

As a result, potential customers may abandon the booking process before completing a reservation.

---

## MVP Goal

Enable a client to discover and reserve a fitness class online in less than one minute without contacting club staff.

---

## User Types

### Client

A person who wants to attend fitness classes.

Can:

* Create an account
* Log in
* Browse available classes
* Reserve a spot in a class
* Cancel a reservation
* View their upcoming reservations

### Administrator

A club employee responsible for managing the schedule.

Can:

* Create classes
* Edit classes
* Delete classes
* Set participant limits
* View class attendees

---

## Minimum Feature Set (MVP)

### Authentication

* User registration
* User login
* Role-based access (Client / Administrator)

### Class Management

Administrators can:

* Create classes
* Edit classes
* Delete classes
* Define the maximum number of participants

### Class Browsing

Clients can:

* View upcoming classes
* See class details
* Check available spots

### Reservations

Authenticated clients can:

* Reserve a spot in a class
* Cancel a reservation
* View their reservations

### Business Rules

The system must:

* Prevent duplicate reservations for the same class
* Prevent reservations when a class is full
* Prevent reservations after a class has started
* Automatically update available spots when reservations are created or canceled

---

## Data Model

### User

* id
* email
* password
* role

### Class

* id
* title
* description
* instructor
* classType
* intensityLevel
* startDate
* durationMinutes
* maxParticipants

### Reservation

* id
* userId
* classId
* createdAt

---

## Success Criteria

The MVP is considered complete when:

1. Users can create an account and log in.
2. Administrators can manage classes.
3. Clients can reserve a class.
4. Clients can cancel a reservation.
5. The system prevents bookings when a class is full.
6. The system prevents duplicate bookings for the same class.
7. At least one end-to-end test verifies the primary user flow.
8. A working CI/CD pipeline is configured.

---

## Out of Scope

To keep the project focused and achievable, the following features are explicitly excluded from the MVP.

### Multi-Club Support

The application supports only a single fitness club.

### Online Payments

No payment processing integration.

### Memberships and Passes

No support for subscriptions, memberships, or class packages.

### SMS Notifications

No SMS integration.

### Email Notifications

No automated emails in the MVP version.

### Social Media Integrations

No Facebook, Instagram, or Messenger integrations.

### Mobile Application

The MVP is a web application only.

### External Calendar Integrations

No Google Calendar or Apple Calendar synchronization.

### Reviews and Ratings

No feedback or review functionality.

---

## Future Enhancements (If Time Allows)

### Waiting List

Users can join a waiting list when a class is fully booked.

### Email Notifications

Automatic booking confirmations and cancellation emails.

### Attendance History

Users can view previously attended classes.

### Instructor Profiles

Additional information about instructors.

### Search and Filters

Filter classes by:

* Class intensity level
* Instructor
* Day of the week

### Admin Dashboard

Basic statistics such as:

* Number of participants
* Most popular classes
* Class occupancy rates

### AI Features

* Generate class descriptions
* Recommend classes based on user history
* Analyze class popularity and suggest schedule improvements

---

## Primary User Journey

1. A client creates an account.
2. The client logs in.
3. The client browses available classes.
4. The client selects a class.
5. The client reserves a spot.
6. The system updates the number of available spots.
7. The reservation appears in the client's account.
