-- Blood Donation & Request Matching System
-- Original eight-table relational baseline, based on the submitted Lab 4 design.
-- Target: MySQL 8.0.16+ (CHECK constraints are enforced in these versions).
--
-- IMPORTANT:
-- 1. Run this file only when creating a NEW, EMPTY BloodDonationDB database.
-- 2. Do NOT run it against the existing populated project database; its tables
--    already exist and contain application/test data.
-- 3. After creating this baseline schema, run the application's additive
--    migrations from backend/src/migrations using `npm run migrate`.
-- 4. The current implementation uses VARCHAR(2) for Blood_Type so values
--    such as 'AB' fit. The original Lab 4 execution screenshot shows CHAR(1);
--    VARCHAR(2) is used here to match the working application schema.
-- 5. Donation.Hospital_ID, Hospital.User_ID, Organization.User_ID and
--    IntegrationOutbox are implementation extensions added by migrations;
--    they are intentionally not part of this original eight-table baseline.

CREATE DATABASE IF NOT EXISTS BloodDonationDB;
USE BloodDonationDB;

-- 1. User: shared account and authentication details for all application roles.
CREATE TABLE `User` (
    User_ID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE NOT NULL,
    Phone VARCHAR(15),
    Password VARCHAR(255) NOT NULL,
    Role ENUM('Donor', 'Admin', 'Hospital', 'Organization') NOT NULL
) ENGINE=InnoDB;

-- 2. BloodGroup: master list of ABO and Rh blood groups.
CREATE TABLE BloodGroup (
    BloodGroup_ID INT PRIMARY KEY AUTO_INCREMENT,
    Blood_Type VARCHAR(2) NOT NULL,
    Rh_Factor CHAR(1) NOT NULL,
    UNIQUE (Blood_Type, Rh_Factor)
) ENGINE=InnoDB;

-- 3. Donor: donor-specific information linked to a user and blood group.
CREATE TABLE Donor (
    Donor_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT UNIQUE NOT NULL,
    BloodGroup_ID INT NOT NULL,
    Date_of_Birth DATE,
    Gender ENUM('Male', 'Female', 'Other'),
    Availability_Status BOOLEAN DEFAULT TRUE,
    Last_Donation_Date DATE,
    FOREIGN KEY (User_ID) REFERENCES `User`(User_ID),
    FOREIGN KEY (BloodGroup_ID) REFERENCES BloodGroup(BloodGroup_ID)
) ENGINE=InnoDB;

-- 4. Donation: donation records submitted by donors.
CREATE TABLE Donation (
    Donation_ID INT PRIMARY KEY AUTO_INCREMENT,
    Donor_ID INT NOT NULL,
    BloodGroup_ID INT NOT NULL,
    Donation_Date DATE NOT NULL,
    Quantity DECIMAL(5,2) NOT NULL,
    Donation_Status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    FOREIGN KEY (Donor_ID) REFERENCES Donor(Donor_ID),
    FOREIGN KEY (BloodGroup_ID) REFERENCES BloodGroup(BloodGroup_ID)
) ENGINE=InnoDB;

-- 5. Hospital: hospital master and contact information.
CREATE TABLE Hospital (
    Hospital_ID INT PRIMARY KEY AUTO_INCREMENT,
    Hospital_Name VARCHAR(150) NOT NULL,
    Address VARCHAR(255),
    Phone VARCHAR(15),
    Email VARCHAR(100) UNIQUE
) ENGINE=InnoDB;

-- 6. Organization: blood-donation organization details.
CREATE TABLE Organization (
    Organization_ID INT PRIMARY KEY AUTO_INCREMENT,
    Organization_Name VARCHAR(150) NOT NULL,
    Address VARCHAR(255),
    Phone VARCHAR(15),
    Email VARCHAR(100) UNIQUE,
    Organization_Type VARCHAR(100)
) ENGINE=InnoDB;

-- 7. BloodRequest: request submitted by exactly one hospital or organization.
CREATE TABLE BloodRequest (
    Request_ID INT PRIMARY KEY AUTO_INCREMENT,
    Hospital_ID INT,
    Organization_ID INT,
    BloodGroup_ID INT NOT NULL,
    Quantity_Required DECIMAL(5,2) NOT NULL,
    Request_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Urgency ENUM('Low', 'Medium', 'High', 'Critical') DEFAULT 'Medium',
    Request_Status ENUM(
        'Pending',
        'Partially_Fulfilled',
        'Fulfilled',
        'Cancelled'
    ) DEFAULT 'Pending',
    FOREIGN KEY (Hospital_ID) REFERENCES Hospital(Hospital_ID),
    FOREIGN KEY (Organization_ID) REFERENCES Organization(Organization_ID),
    FOREIGN KEY (BloodGroup_ID) REFERENCES BloodGroup(BloodGroup_ID),
    CHECK (
        (Hospital_ID IS NOT NULL AND Organization_ID IS NULL)
        OR
        (Hospital_ID IS NULL AND Organization_ID IS NOT NULL)
    )
) ENGINE=InnoDB;

-- 8. BloodInventory: available quantity for each hospital and blood group.
CREATE TABLE BloodInventory (
    Inventory_ID INT PRIMARY KEY AUTO_INCREMENT,
    Hospital_ID INT NOT NULL,
    BloodGroup_ID INT NOT NULL,
    Quantity_Available DECIMAL(5,2) DEFAULT 0,
    Last_Updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Hospital_ID) REFERENCES Hospital(Hospital_ID),
    FOREIGN KEY (BloodGroup_ID) REFERENCES BloodGroup(BloodGroup_ID),
    UNIQUE (Hospital_ID, BloodGroup_ID)
) ENGINE=InnoDB;

-- Optional verification after execution:
-- SHOW TABLES;
-- DESCRIBE `User`;
-- DESCRIBE BloodGroup;
-- DESCRIBE Donor;
-- DESCRIBE Donation;
-- DESCRIBE Hospital;
-- DESCRIBE Organization;
-- DESCRIBE BloodRequest;
-- DESCRIBE BloodInventory;
