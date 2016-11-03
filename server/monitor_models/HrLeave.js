module.exports = function(sequelize, DataTypes) {
    var HrLeave = sequelize.define('HrLeave', {
        leave_id: {
            type: DataTypes.INTEGER(11),
            primaryKey: true,
            autoIncrement: true
        },
        application_date: DataTypes.DATE,
        start_date: DataTypes.DATE,
        finish_date: DataTypes.DATE,
        work_date: DataTypes.DATE,
        standard: DataTypes.INTEGER(11),
        status_id: DataTypes.INTEGER(11),
        time_leave: DataTypes.INTEGER(11),
        reason_leave: DataTypes.STRING(500),
        is_approve_first: DataTypes.INTEGER(11),
        is_approve_second: DataTypes.INTEGER(11),
        status_id_first: DataTypes.INTEGER(11),
        is_reject: DataTypes.INTEGER(11),
        status_id_second: DataTypes.INTEGER(11),
        user_id: DataTypes.INTEGER(11),
        comments: DataTypes.STRING(500),
        creation_date: DataTypes.DATE,
        last_update_date: DataTypes.DATE,
        created_by: DataTypes.INTEGER(11),
        last_updated_by: DataTypes.INTEGER(11)
    }, {
          tableName: "hr_leave"
    });
    return HrLeave;
};
