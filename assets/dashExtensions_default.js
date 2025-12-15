window.dashExtensions = Object.assign({}, window.dashExtensions, {
    default: {
        function0: function(cluster) {
            const childCount = cluster.getChildCount();
            let size = 'small';
            let c = ' marker-cluster-';

            if (childCount < 10) {
                c += 'small';
                size = 30;
            } else if (childCount < 100) {
                c += 'medium';
                size = 40;
            } else {
                c += 'large';
                size = 50;
            }

            return new L.DivIcon({
                html: '<div style="background-color: rgba(231, 76, 60, 0.6); border-radius: 50%; width: ' + size + 'px; height: ' + size + 'px; display: flex; align-items: center; justify-content: center; border: 3px solid rgba(192, 57, 43, 0.8); color: white; font-weight: bold; font-size: ' + (size / 3) + 'px;">' + childCount + '</div>',
                className: 'marker-cluster' + c,
                iconSize: new L.Point(size, size)
            });
        },
        function1: function(feature, latlng, index) {
            const childCount = feature.properties.point_count;
            let size = 40;

            if (childCount < 10) {
                size = 35;
            } else if (childCount < 100) {
                size = 45;
            } else if (childCount < 1000) {
                size = 55;
            } else {
                size = 65;
            }

            const icon = L.divIcon({
                html: '<div style="background-color: rgba(231, 76, 60, 0.7); border-radius: 50%; width: ' + size + 'px; height: ' + size + 'px; display: flex; align-items: center; justify-content: center; border: 4px solid rgba(192, 57, 43, 1); color: white; font-weight: bold; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">' + childCount + '</div>',
                className: 'custom-cluster-icon',
                iconSize: L.point(size, size)
            });
            return L.marker(latlng, {
                icon: icon
            });
        },
        function2: function(feature, latlng) {
            const icon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            return L.marker(latlng, {
                icon: icon
            });
        }
    }
});