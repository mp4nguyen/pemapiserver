use sakila2;



CREATE or REPLACE VIEW `booking_cadidates_v`
AS SELECT
   ifnull(`subcom`.`Company_name`,
   `com`.`Company_name`) AS `company_name`,
   `h`.`Booking_id` AS `Booking_id`,
   `h`.`PO_Number` AS `PO_Number`,
   `h`.`result_email` AS `Result_Email`,
   `h`.`invoice_email` AS `Invoice_Email`,
   `h`.`Project_Identofication` AS `Project_Identofication`,
   `h`.`Comments` AS `Comments`,
   `h`.`package_id` AS `package_id`,
   `p`.`package_name` AS `package_name`,ifnull(`p`.`fee`,0) AS `fee`,
   `a`.`ASS_NAME` AS `ass_name`,
   `c`.`SITE_ID` AS `site_id`,
   `s`.`Site_name` AS `site_name`,
   `h`.`company_id` AS `company_id`,
   `h`.`sub_company_id` AS `sub_company_id`,
   `subcom`.`Company_name` AS `sub_company_name`,ifnull(`h`.`Booking_Person`,'') AS `Booking_Person`,
   `h`.`contact_number` AS `contact_number`,
   `c`.`Candidate_id` AS `Candidate_id`,
   `c`.`Candidates_name` AS `Candidates_name`,
   `c`.`DoB` AS `DoB`,
   `c`.`Phone` AS `Phone`,
   `c`.`Email` AS `Email`,
   `c`.`Position` AS `Position`,
   `c`.`Appointment_time` AS `Appointment_time`,if((`c`.`Appointment_notes` = NULL),'',`c`.`Appointment_notes`) AS `Appointment_notes`,
   `c`.`Appointment_status` AS `Appointment_status`,if((`c`.`RediMed_note` = NULL),'',`c`.`RediMed_note`) AS `RediMed_note`,
   `c`.`SITE_ID` AS `Csite_id`,ifnull(`c`.`FROM_DATE`,now()) AS `from_date`,
   `c`.`TO_DATE` AS `to_date`,
   `c`.`CALENDAR_ID` AS `calendar_id`,
   `c`.`resultFile` AS `resultFile`,if((`c`.`resultFileName` = NULL),'',`c`.`resultFileName`) AS `resultFileName`,
   `c`.`Creation_date` AS `creation_date`,
   `c`.`Created_by` AS `created_by`,
   `c`.`Last_update_date` AS `last_update_date`,
   `c`.`Last_updated_by` AS `last_updated_by`,
   `h`.`isBookingAtRediMed` AS `isBookingAtRediMed`
FROM (((((`booking_headers` `h` join (`booking_candidates` `c` left join `redimedsites` `s` on((`c`.`SITE_ID` = `s`.`id`))) on((`h`.`Booking_id` = `c`.`Booking_id`))) left join `packages_assessments_v` `a` on((`h`.`package_id` = `a`.`pack_id`))) left join `packages` `p` on((`h`.`package_id` = `p`.`id`))) left join `companies` `com` on((`h`.`company_id` = `com`.`id`))) left join `companies` `subcom` on((`h`.`sub_company_id` = `subcom`.`id`)));


drop table packages_assessments_v;

CREATE or replace VIEW `packages_assessments_v` as
SELECT
   pa.pack_id AS `pack_id`,
    group_concat(a.`ass_name` separator '<br>') AS `ASS_NAME`
FROM 
	`packages_assessments` pa,
	assessments a
where
	pa.ass_id = a.id	 
group by 
	`pa`.`pack_id`;


create or replace view company_child_v as
select * from companies where father_id is not null;

alter table positions add (id int);

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `packages_assessments_v`
AS SELECT
   `packages_assessments`.`pack_id` AS `pack_id`,
    group_concat(`packages_assessments`.`ass_name` separator '<br>') AS `ASS_NAME`
FROM 
	`packages_assessments` 
group by `packages_assessments`.`pack_id`;


create or replace view package_assessment_headers_v as
select 
	concat(ah.id,'00000000',p.pack_id) as id,
	p.pack_id,
	ah.id as ass_header_id,
	ah.ass_name as header_name
from 	
	packages_assessments p,
	assessments a,
	assessment_headers ah
where
	a.header_id = ah.id
	and a.id = p.ass_id
group by 
	p.pack_id,ah.id,ah.ass_name;
	

select * from package_assessments_with_header_v;

create or replace view package_assessments_with_header_v as
select 
	concat(ah.id,'00000000',p.pack_id) as id,
	p.pack_id,
	ah.id as ass_header_id,
	a.id as ass_id,
	ah.ass_name as header_name,
	a.ass_name
from 	
	packages_assessments p,
	assessments a,
	assessment_headers ah
where
	a.header_id = ah.id
	and a.id = p.ass_id
order by 
	p.pack_id,ah.id,a.id;
	
CREATE OR REPLACE VIEW `booking_cadidates_v`
AS SELECT
   ifnull(`subcom`.`Company_name`,
   `com`.`Company_name`) AS `company_name`,
   `h`.`booking_id` AS `Booking_id`,
   `h`.`PO_Number` AS `PO_Number`,
   `h`.`result_email` AS `Result_Email`,
   `h`.`invoice_email` AS `Invoice_Email`,
   `h`.`Project_Identofication` AS `Project_Identofication`,
   ifnull(`h`.`Comments`,'') AS `Comments`,
   `h`.`package_id` AS `package_id`,
   `p`.`package_name` AS `package_name`,ifnull(`p`.`fee`,0) AS `fee`,
   `a`.`ASS_NAME` AS `ass_name`,
   `c`.`SITE_ID` AS `site_id`,
   `s`.`Site_name` AS `site_name`,
   `h`.`company_id` AS `company_id`,
   `h`.`sub_company_id` AS `sub_company_id`,
   `subcom`.`Company_name` AS `sub_company_name`,ifnull(`h`.`Booking_Person`,'') AS `Booking_Person`,
   `h`.`contact_number` AS `contact_number`,
   `c`.`candidate_id` AS `Candidate_id`,
   `c`.`Candidates_name` AS `Candidates_name`,
   `c`.`DoB` AS `DoB`,
   `c`.`Phone` AS `Phone`,
   `c`.`Email` AS `Email`,
   `c`.`Position` AS `Position`,
   `c`.`Appointment_time` AS `Appointment_time`,ifnull(`c`.`Appointment_notes`,'') AS `Appointment_notes`,
   `c`.`Appointment_status` AS `Appointment_status`,if((`c`.`RediMed_note` = NULL),'',`c`.`RediMed_note`) AS `RediMed_note`,
   `c`.`SITE_ID` AS `Csite_id`,ifnull(`c`.`FROM_DATE`,now()) AS `from_date`,
   `c`.`TO_DATE` AS `to_date`,
   `c`.`CALENDAR_ID` AS `calendar_id`,
   `c`.`resultFile` AS `resultFile`,if((`c`.`resultFileName` = NULL),'',`c`.`resultFileName`) AS `resultFileName`,
   `c`.`Creation_date` AS `creation_date`,
   `c`.`Created_by` AS `created_by`,
   `c`.`Last_update_date` AS `last_update_date`,
   `c`.`Last_updated_by` AS `last_updated_by`,
   `h`.`isBookingAtRediMed` AS `isBookingAtRediMed`
FROM (((((`booking_headers` `h` join (`booking_candidates` `c` left join `redimedsites` `s` on((`c`.`SITE_ID` = `s`.`id`))) on((`h`.`booking_id` = `c`.`Booking_id`))) left join `packages_assessments_v` `a` on((`h`.`package_id` = `a`.`pack_id`))) left join `packages` `p` on((`h`.`package_id` = `p`.`id`))) left join `companies` `com` on((`h`.`company_id` = `com`.`id`))) left join `companies` `subcom` on((`h`.`sub_company_id` = `subcom`.`id`)))
order by `c`.`candidate_id` desc;

set @rownum:=0;
update positions set id = @rownum:=@rownum+1;

select * from positions;
desc positions;

alter table accounts MODIFY column id int auto_increment,auto_increment = 1000;
	
alter table booking_headers MODIFY column booking_id int auto_increment;

alter table booking_candidates MODIFY column candidate_id int auto_increment , auto_increment = 30005;

alter table positions MODIFY column id int primary key auto_increment;

ALTER TABLE ... CHANGE COLUMN `Id` `Id` INT(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = 123456;

select * from booking_headers order by booking_id desc;

select * from booking_candidates order by candidate_id desc;

select * from booking_cadidates_v order by candidate_id desc;

select candidate_id,count(candidate_id) from booking_candidates group by candidate_id having count(candidate_id) > 1;

desc booking_candidates;
desc booking_headers;
desc accounts;

delete from booking_headers where booking_id = 10000000	;

delete from  accounts where id = -1;

select email,count(email) from accounts group by email having count(email) > 1;


create table accounts select * from users;

alter table accounts add column (
realm	varchar(512)	,
username	varchar(512),	
credentials	text,	
challenges	text,	
email	varchar(512),	
emailVerified	tinyint(1)	,	
verificationToken	varchar(512),	
status	varchar(512),
created	datetime,		
lastUpdated	datetime
);

update accounts set email = Contact_email,username = user_name;


ALTER TABLE accounts DROP COLUMN user_name;

select * from users_bk;

select * from packages;

select * from packages_assessments where pack_id = 19;

select * from booking_cadidates_v order by booking_id desc;

create table sys_booking_status
(
	booking_status varchar(100),
	Created_by int,
	Creation_date datetime,
	Last_updated_by int,
	Last_update_date datetime
);

insert into sys_booking_status (booking_status) values ('Confirmed'),('Pending'),('Rescheduled'),('Cancel'),('Attended');

select * from sys_booking_status;

select * from booking_headers order by booking_id desc;

select * from packages_assessments_v order by pack_id desc;

CREATE TABLE `client_logs` (
  `errorTime` datetime DEFAULT NULL,
  `userId` int(11) DEFAULT NULL,
  `browser` varchar(50) DEFAULT NULL,
  `fingerPrint` varchar(50) DEFAULT NULL,
  `errorUrl` text,
  `errorMessage` text,
  `stackTrace` text,
  `cause` text,
  `ip` varchar(20) DEFAULT NULL,
  `hostname` varchar(100) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `loc` varchar(100) DEFAULT NULL,
  `org` varchar(100) DEFAULT NULL,
  `postal` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

desc client_logs;

select  * from angular_log order by logtime desc;

select  date_format(logtime,'%d %M %Y %h:%m:%s:%f')  from angular_log order by logtime desc;

drop table angular_log;
create table angular_log 
(
                    userid int,
                    logtime datetime(6),
                    content1 text,
                    content2 MEDIUMTEXT,
                    browser varchar(50),
                    country varchar(50),
                    fingerprint varchar(50),
                    ip varchar(50),
                    loc varchar(50),
                    region varchar(50)
);



CREATE TABLE `test_table` (
`name` VARCHAR(1000) ,
`orderdate` DATETIME(6)
);

INSERT INTO test_table VALUES('A','2010-12-10 14:12:09.123');

SELECT * FROM packages order by id desc;

SELECT * FROM packages order by id;


use sakila2;

select email,count(email) from Accounts group by email having count(email) > 1;

select * from accounts where email = 'pnguyen@redimed.com.au';

select * from booking_cadidates_v order by booking_id desc;


select * from angular_log order by logtime desc;