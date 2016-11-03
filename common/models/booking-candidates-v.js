module.exports = function(BookingCandidatesV) {
    BookingCandidatesV.on('attached', function(obj){
        var find = BookingCandidatesV.find;
        BookingCandidatesV.find = function(filter, cb) {
            console.log("arg=",arguments[0]);
            console.log("filter",filter);
            if(arguments[0]){
                arguments[0].order = "creationDate DESC";
            }else{
                arguments[0] = {};
                arguments[0].order = "creationDate DESC";
            }

            console.log("arg=",arguments[0]);
            return find.apply(this, arguments);
        };
    });
};
