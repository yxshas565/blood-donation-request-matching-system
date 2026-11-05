CREATE TABLE IF NOT EXISTS BloodGroup (
    BloodGroup_ID INT PRIMARY KEY AUTO_INCREMENT,
    Blood_Group VARCHAR(5) NOT NULL UNIQUE,
    Rh_Type VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS `User` (
    User_ID INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Donor (
    Donor_ID INT PRIMARY KEY AUTO_INCREMENT,
    User_ID INT NOT NULL,
    BloodGroup_ID INT NOT NULL,
    Age INT NOT NULL,
    Availability_Status BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (User_ID) REFERENCES `User`(User_ID),
    FOREIGN KEY (BloodGroup_ID) REFERENCES BloodGroup(BloodGroup_ID)
);

CREATE TABLE IF NOT EXISTS Donation (
    Donation_ID INT PRIMARY KEY AUTO_INCREMENT,
    Donor_ID INT NOT NULL,
    Quantity INT NOT NULL,
    Donation_Status VARCHAR(20) DEFAULT 'Pending',
    Donation_Date DATE,
    FOREIGN KEY (Donor_ID) REFERENCES Donor(Donor_ID)
);

CREATE TABLE IF NOT EXISTS BloodRequest (
    Request_ID INT PRIMARY KEY AUTO_INCREMENT,
    BloodGroup_ID INT NOT NULL,
    Quantity INT NOT NULL,
    Request_Status VARCHAR(20) DEFAULT 'Pending',
    FOREIGN KEY (BloodGroup_ID) REFERENCES BloodGroup(BloodGroup_ID)
);

INSERT IGNORE INTO BloodGroup (BloodGroup_ID, Blood_Group, Rh_Type) VALUES
(1,'A+','Positive'),(2,'A-','Negative'),
(3,'B+','Positive'),(4,'B-','Negative'),
(5,'AB+','Positive'),(6,'AB-','Negative'),
(7,'O+','Positive'),(8,'O-','Negative');

INSERT IGNORE INTO `User` (User_ID, Name, Email) VALUES
(1,'Arjun Kumar','arjun.demo@example.com'),
(2,'Priya Sharma','priya.demo@example.com'),
(3,'Rahul Verma','rahul.demo@example.com'),
(4,'Sneha Rao','sneha.demo@example.com');

INSERT IGNORE INTO Donor (Donor_ID,User_ID,BloodGroup_ID,Age,Availability_Status) VALUES
(1,1,1,24,TRUE),(2,2,7,27,TRUE),
(3,3,3,22,FALSE),(4,4,5,29,TRUE);

INSERT IGNORE INTO Donation (Donation_ID,Donor_ID,Quantity,Donation_Status,Donation_Date) VALUES
(1,1,450,'Approved','2026-09-10'),
(2,2,350,'Approved','2026-09-15'),
(3,3,400,'Pending','2026-10-01');

INSERT IGNORE INTO BloodRequest (Request_ID,BloodGroup_ID,Quantity,Request_Status) VALUES
(1,1,2,'Pending'),(2,7,3,'Approved'),(3,3,1,'Pending');
